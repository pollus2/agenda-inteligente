export type DashboardAppointment = {
  id: string;
  dayKey: string;
  time: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  status: string;
};

export type DashboardDay = {
  key: string;
  label: string;
  dateNumber: number;
  count: number;
  isToday: boolean;
};

export type DashboardServicePopularity = {
  name: string;
  count: number;
};

export type DashboardStats = {
  appointmentsToday: number;
  appointmentsWeek: number;
  clients: number;
  professionals: number;
  services: number;
};
