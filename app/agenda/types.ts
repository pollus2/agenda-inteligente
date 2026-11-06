export type Appointment = {
  id: string;
  start_at: string;
  end_at: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  status: string;
  price: number;
  notes: string | null;
};

export type AppointmentClient = { id: string; name: string; phone: string | null };
export type AppointmentProfessional = { id: string; name: string; active: boolean };
export type AppointmentService = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  active: boolean;
};
export type BusinessHours = {
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
};
