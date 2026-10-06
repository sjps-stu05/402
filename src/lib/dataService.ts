import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Student, MoodType, PassportEntry, DailyMood, SELData } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeData(data: any): any {
  const sanitized = JSON.parse(JSON.stringify(data));
  // Remove any fields that are still undefined or null if needed
  return sanitized;
}

// Utility for Image Resizing with automatic adaptive compression for Firestore limits
export async function resizeImage(
  base64: string, 
  maxSide: number = 1200, 
  targetSize?: { width: number, height: number },
  maxChars: number = 750000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (targetSize) {
        width = targetSize.width;
        height = targetSize.height;
      } else if (width > maxSide || height > maxSide) {
        if (width > height) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Adaptive compression loop to guarantee it fits safely within Firestore document limits
      let quality = 0.82;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      while (dataUrl.length > maxChars && quality > 0.3) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // If still too large, downscale canvas dimensions
      if (dataUrl.length > maxChars) {
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = Math.round(width * 0.7);
        smallerCanvas.height = Math.round(height * 0.7);
        const sCtx = smallerCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
          dataUrl = smallerCanvas.toDataURL('image/jpeg', 0.6);
        }
      }

      resolve(dataUrl);
    };
    img.onerror = reject;
  });
}

// Data Services
export const DataService = {
  // Students
  async getStudents(): Promise<Student[]> {
    const path = 'students';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeStudents(callback: (students: Student[]) => void, onError?: (error: any) => void) {
    const path = 'students';
    return onSnapshot(collection(db, path), (snapshot) => {
      const students = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
      callback(students);
    }, (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  },

  async saveStudent(student: Student): Promise<void> {
    const path = `students/${student.id}`;
    try {
      await setDoc(doc(db, 'students', student.id), sanitizeData(student));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // 只更新狀態欄位，不會覆蓋頭像等其他資料
  async updateStudentStatus(id: string, status: 'focus' | 'quiet' | 'help'): Promise<void> {
    const path = `students/${id}`;
    try {
      await updateDoc(doc(db, 'students', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteStudent(id: string): Promise<void> {
    const path = `students/${id}`;
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Mood History
  async getMoodHistory(): Promise<DailyMood[]> {
    const path = 'moodHistory';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => doc.data() as DailyMood).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeMoodHistory(callback: (history: DailyMood[]) => void, onError?: (error: any) => void) {
    const path = 'moodHistory';
    return onSnapshot(collection(db, path), (snapshot) => {
      const history = snapshot.docs.map(doc => doc.data() as DailyMood).sort((a, b) => a.date.localeCompare(b.date));
      callback(history);
    }, (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  },

  async saveDailyMood(dailyMood: DailyMood): Promise<void> {
    const path = `moodHistory/${dailyMood.date}`;
    try {
      await setDoc(doc(db, 'moodHistory', dailyMood.date), sanitizeData(dailyMood));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Passport Entries
  async getPassportEntries(): Promise<PassportEntry[]> {
    const path = 'passportEntries';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as PassportEntry);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribePassportEntries(callback: (entries: PassportEntry[]) => void, onError?: (error: any) => void) {
    const path = 'passportEntries';
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => doc.data() as PassportEntry);
      callback(entries);
    }, (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  },

  async savePassportEntry(entry: PassportEntry): Promise<void> {
    const path = `passportEntries/${entry.id}`;
    try {
      if (entry.image && entry.image.length > 900000) {
        throw new Error('圖片檔案太大了，請嘗試使用較小的圖片。');
      }
      await setDoc(doc(db, 'passportEntries', entry.id), sanitizeData(entry));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Metadata (Banner)
  async getMetadata(): Promise<{ classroomImage?: string }> {
    const path = 'metadata/global';
    try {
      const snapshot = await getDoc(doc(db, 'metadata', 'global'));
      return snapshot.data() || {};
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return {};
    }
  },

  subscribeMetadata(callback: (metadata: { classroomImage?: string }) => void, onError?: (error: any) => void) {
    const path = 'metadata/global';
    return onSnapshot(doc(db, 'metadata', 'global'), (snapshot) => {
      callback(snapshot.data() || {});
    }, (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.GET, path);
      }
    });
  },

  async saveMetadata(metadata: { classroomImage?: string }): Promise<void> {
    const path = 'metadata/global';
    try {
      if (metadata.classroomImage && metadata.classroomImage.length > 850000) {
        metadata.classroomImage = await resizeImage(metadata.classroomImage, 1000, undefined, 700000);
      }
      await setDoc(doc(db, 'metadata', 'global'), sanitizeData(metadata));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Bulk Save (for migration or JSON update)
  async syncAll(data: SELData): Promise<void> {
    // This could be optimized with batches, but for simplicity:
    for (const student of data.students) {
      await this.saveStudent(student);
    }
    for (const mood of data.moodHistory) {
      await this.saveDailyMood(mood);
    }
    for (const entry of data.passportEntries) {
      await this.savePassportEntry(entry);
    }
    if (data.classroomImage) {
      await this.saveMetadata({ classroomImage: data.classroomImage });
    }
  }
};
