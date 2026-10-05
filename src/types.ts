export type MoodType = 'sun' | 'cloud' | 'rain' | 'storm';

export interface PassportEntry {
  id: string;
  timestamp: number;
  incident: string;
  mood: MoodType;
  result: string;
  studentId: string;
  studentName: string;
  image?: string;
}

export interface DailyMood {
  date: string;
  moods: { [studentId: string]: MoodType };
}

export interface Student {
  id: string;
  name: string;
  status: 'focus' | 'quiet' | 'help';
  avatar?: string;
}

export interface SELData {
  students: Student[];
  moodHistory: DailyMood[];
  passportEntries: PassportEntry[];
  classroomImage?: string;
}
