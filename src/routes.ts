export const routes = {
  join: "/",
  play: (session: string) => `/play/${session}`,
  library: "/teacher",
  teach: (session: string) => `/teacher/session/${session}`,
};
