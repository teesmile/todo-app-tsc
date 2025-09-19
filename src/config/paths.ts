export const paths = {
  home: () => '/',
  app: {
    root: '/todos',
    todo: {
      getHref: (id: string) => `/todos/${id}`,
    },
    todos: () => '/todos',
  },
  auth: {
    login: () => '/auth/login',
    register: () => '/auth/register',
  },
} as const;