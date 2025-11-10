# Project Context

## Purpose
The Badminton Club App is a full-stack web application designed to manage a badminton club's operations, including:
- Member registration and Membership management
- Player profile management with team affiliations
- Match scheduling and lineup management
- Content management system for club homepage
- Administrative functions, batch operations for administrative efficiency
- Membership application workflow with PDF generation
- Responsive multi-language interface

## Architecture

**📚 [Complete Architecture Documentation](./ARCHITECTURE.md)**

The complete system architecture, patterns, and guidelines are documented in `ARCHITECTURE.md`. This includes:
- Layered type system (Core → Domain → Persistence → API → View)
- Frontend/Backend architecture patterns
- Data flow and transformation rules
- Component patterns and best practices
- Development guidelines and common pitfalls

**All contributors MUST read ARCHITECTURE.md before making changes.**

## Tech Stack
**Frontend:**
- Next.js 15 (App Router, React Server Components)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- next-intl (i18n: de/en/zh)
- TanStack Query (data fetching/caching)

**Backend:**
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT authentication
- RESTful API

### Development Tools
- pnpm workspace (monorepo)
- Jest for testing
- ESLint and Prettier for code formatting

## Project Conventions

### Code Style
- TypeScript strict mode enabled
- ESLint with recommended TypeScript rules
- Prettier for code formatting
- File naming: kebab-case for files, PascalCase for components
- Function naming: camelCase for functions, PascalCase for React components
- Type definitions in shared/types directory

### Architecture Patterns
- Monorepo structure with apps/ and shared/ directories
- MVC pattern for API controllers
- Service layer for business logic
- Repository pattern for data access
- Shared types between frontend and backend
- Type-safe API requests and responses
- Model-based validation
- Middleware-based authentication and authorization
- Centralized error handling

### Testing Strategy
- Jest for unit testing
- Integration tests for API endpoints
- Test files co-located with source files
- Required test coverage for core business logic
- Mock external dependencies in tests

### Git Workflow
- Feature branches from main
- Branch naming: feature/, bugfix/, refactor/
- Conventional commits (feat:, fix:, refactor:, etc.)
- Pull request reviews required
- Squash merging to main

## Domain Context
- User Roles: super admin, admin, member, applicant
- Membership Types: regular, student
- Player Management: tracking player status, skills, and team affiliations
- Team Management: team formations, roles (captain, player)
- Match Management: scheduling, results tracking, lineup management
- Content Management: multi-language support for club communications
- Membership Applications: workflow from application to approval/rejection

## Important Constraints
- Data Privacy: GDPR compliance for EU members
- Authentication: Required for most operations
- Authorization: Role-based access control
- Performance: API response time < 500ms
- Availability: 99.9% uptime target
- Mobile Responsive: All user interfaces
- Accessibility: WCAG 2.1 Level AA compliance

## External Dependencies
- MongoDB Atlas for database
- AWS S3 for file storage
- SendGrid for email notifications
- Stripe for payment processing (planned)
- GitHub Actions for CI/CD
