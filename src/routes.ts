export const routes = {
  join: "/",
  play: (session: string) => `/play/${session}`,
  projection: "/teacher",
  remote: "/remote",
  teach: (session: string) => `/teacher/session/${session}`,
};
