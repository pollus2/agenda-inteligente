export type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  active: boolean;
};

