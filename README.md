# Todo App - TypeScript & Next.js

A modern todo application built with Next.js 15, TypeScript, and Tailwind CSS. This project demonstrates TypeScript integration with React components, state management, and modern Next.js features.

## Features

- ✅ **TypeScript Integration**: Fully typed React components and interfaces
- ✅ **Modern Next.js 15**: Uses the App Router for optimal performance 
- ✅ **Responsive Design**: Mobile-first design with Tailwind CSS
- ✅ **Todo Management**: Add, toggle, delete, and filter todos
- ✅ **Type Safety**: Complete TypeScript coverage with proper interfaces
- ✅ **Fast Refresh**: Hot reloading with Turbopack in development
- ✅ **ESLint**: Code quality and consistency checks

## Project Structure

```
todo-app-tsc/
├── src/
│   ├── app/                    # App Router pages and layout
│   │   ├── layout.tsx         # Root layout with metadata
│   │   ├── page.tsx           # Main todo page
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable React components
│   │   ├── TodoItem.tsx       # Individual todo item component
│   │   └── TodoFilters.tsx    # Filter buttons component
│   └── types/                 # TypeScript type definitions
│       └── todo.ts            # Todo interfaces and types
├── pages-example/             # Pages Router examples (for reference)
├── tsconfig.json              # TypeScript configuration
├── next.config.ts             # Next.js configuration
└── package.json               # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd todo-app-tsc
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or 
   pnpm install
   # or
   bun install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

4. **Open your browser**
   
   Visit [http://localhost:3000](http://localhost:3000) to see the application running.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reloading |
| `npm run build` | Create optimized production build |
| `npm run start` | Start production server (requires build first) |
| `npm run lint` | Run ESLint for code quality checks |
| `npm run type-check` | Run TypeScript compiler to check types |

## TypeScript Configuration

The project includes a comprehensive TypeScript setup:

- **Strict Mode**: Enabled for maximum type safety
- **Path Mapping**: `@/*` aliases to `src/*` for cleaner imports
- **Next.js Plugin**: Automatic type checking and IDE support
- **React Types**: Full typing for React components and props

### Key TypeScript Features

1. **Typed Interfaces**: All data structures are properly typed
   ```typescript
   interface Todo {
     id: string;
     title: string;
     completed: boolean;
     createdAt: Date;
   }
   ```

2. **Generic Components**: Reusable components with proper typing
3. **Event Handlers**: Properly typed form submissions and event handlers
4. **State Management**: Typed useState hooks and state updates

## Development

### Adding New Features

1. **Create Types**: Define interfaces in `src/types/`
2. **Build Components**: Create reusable components in `src/components/` 
3. **Update Pages**: Modify pages in `src/app/`
4. **Type Check**: Run `npm run type-check` to verify types

### Code Quality

The project enforces code quality through:

- **TypeScript**: Static type checking
- **ESLint**: Code style and best practices  
- **Next.js Rules**: Framework-specific linting rules

## Architecture Decisions

### App Router vs Pages Router

This project uses the modern **App Router** (Next.js 13+) by default, but includes Pages Router examples for reference in the `pages-example/` directory.

**App Router Benefits:**
- Server Components by default
- Improved performance with streaming
- Simplified data fetching  
- Better SEO and loading states

### State Management

The application uses React's built-in `useState` for simplicity. For larger applications, consider:
- Context API for global state
- Zustand for lightweight state management
- Redux Toolkit for complex state

## Deployment

### Vercel (Recommended)

Deploy instantly to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/todo-app-tsc)

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm run start
   ```

### Other Platforms

The app can be deployed to any platform that supports Node.js:
- Netlify
- Railway
- Digital Ocean App Platform
- AWS Amplify

## Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Next.js GitHub](https://github.com/vercel/next.js) - Source code and issues

### TypeScript Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Complete TypeScript guide
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/) - React-specific TypeScript patterns

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
