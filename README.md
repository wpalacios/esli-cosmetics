# Esli Cosmetics - Modern Beauty & POS System

A modern, full-stack cosmetics retail and inventory management system built with Next.js 15, NestJS, and PostgreSQL.

![Esli Cosmetics](https://img.shields.io/badge/Esli%20Cosmetics-ff48b0?style=for-the-badge&logo=react)
![Next.js 15](https://img.shields.io/badge/Next.js%2015-000000?style=for-the-badge&logo=nextdotjs)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql)

## ✨ Features

### 🎨 **Modern UI/UX**
- **Brand Identity**: Trendy pink (#ff48b0) theme with glassmorphism effects
- **Responsive Design**: Mobile-first approach with beautiful desktop layouts
- **Accessibility**: WCAG compliant with semantic HTML and ARIA support
- **Dark Mode**: System-aware theme switching

### 🏪 **Point of Sale (POS)**
- Real-time barcode scanning
- Multiple payment methods (cash, card, digital)
- Tax calculations and discount management
- Receipt generation and printing
- Offline-capable transactions

### 📦 **Inventory Management**
- Product catalog with variants and categories
- Stock level tracking across multiple locations
- Automated reorder alerts
- Supplier management
- Purchase order processing

### 👥 **Customer Management**
- Customer profiles and purchase history
- Loyalty programs and rewards
- Contact management and communications
- Customer analytics and insights

### 📊 **Analytics & Reporting**
- Real-time sales dashboards
- Inventory reports and analytics
- Financial summaries and trends
- Performance metrics by location/employee

### 🔐 **Security & Authentication**
- Role-based access control (RBAC)
- JWT authentication with NestJS
- Custom permission system
- Audit logging and compliance

## 🏗️ Architecture

### **Monorepo Structure**
```
esli-cosmetics/
├── apps/
│   ├── web/                 # Next.js 15 web application
│   └── backend/             # NestJS API server
├── packages/
│   ├── ui/                  # Shared UI components (Atomic Design)
│   ├── utils/               # Shared utilities and hooks
│   ├── types/               # TypeScript type definitions
│   └── config/              # Shared configurations (ESLint, Prettier, etc.)
└── scripts/                 # Build and deployment scripts
```

### **Tech Stack**

#### **Frontend**
- **Web**: Next.js 15 with App Router, TypeScript, TailwindCSS
- **UI Library**: Radix UI primitives with custom Esli branding
- **State Management**: React Query (TanStack Query) + Zustand
- **Forms**: React Hook Form with Zod validation

#### **Backend & Database**
- **API**: NestJS 11.x with TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM 6.x
- **Authentication**: JWT with refresh tokens + custom RBAC
- **Validation**: class-validator + class-transformer
- **Documentation**: Auto-generated Swagger/OpenAPI

#### **Development Tools**
- **Build System**: Turbo (Vercel) for monorepo management
- **Package Manager**: pnpm workspaces
- **Linting**: ESLint + Prettier with pre-commit hooks
- **Testing**: Vitest for unit tests, Playwright for E2E

## 🚀 Getting Started

### **Prerequisites**

- Node.js 22.x+ 
- pnpm 10.x+
- PostgreSQL 14+ (or use cloud provider)
- Git

### **Quick Setup (Automated)**

1. **Clone and setup everything**
   ```bash
   git clone https://github.com/your-org/esli-cosmetics.git
   cd esli-cosmetics
   pnpm setup
   ```

That's it! The setup script will:
- Install all dependencies
- Set up environment files
- Configure PostgreSQL database connection
- Run Prisma migrations
- Generate Prisma client and TypeScript types
- Seed database with initial data

### **Manual Installation (Alternative)**

If you prefer manual setup:

1. **Prerequisites**
   ```bash
   # Install required tools
   npm install -g pnpm@10
   # Ensure you have PostgreSQL available (local or cloud)
   ```

2. **Clone and install**
   ```bash
   git clone https://github.com/your-org/esli-cosmetics.git
   cd esli-cosmetics
   pnpm install
   ```

3. **Setup backend database**
   ```bash
   # Configure your database URL in apps/backend/.env
   cp apps/backend/env.example apps/backend/.env
   # Edit the file with your PostgreSQL connection string
   
   # Generate secure authentication secrets
   node scripts/generate-secrets.js
   # Copy the generated secrets to apps/backend/.env
   
   # Generate Prisma client and run migrations
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

4. **Configure frontend environments**
   ```bash
   # Copy templates and edit with your values
   cp apps/web/env.template apps/web/.env.local
   
   # Generate JWT secrets for NestJS (must match across developers)
   node scripts/generate-secrets.js all
   # Copy the generated values to apps/backend/.env
   ```

   **⚠️ CRITICAL:** All developers must use the **SAME** values for:
   - `JWT_SECRET` (NestJS)
   - `JWT_REFRESH_SECRET` (NestJS)
   
   If these differ, you'll get "invalid signature" errors and sessions won't work!

### **Development**

Start all applications in development mode:
```bash
pnpm dev
```

Or run specific applications:
```bash
# Web application (Next.js)
pnpm dev:web

# Backend API (NestJS)
pnpm dev:backend
```

### **API Access**

Once running, the backend API will be available at:
- **API Base**: http://localhost:3001/api/v1
- **Swagger Docs**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api

### **Key API Endpoints**

**Authentication**
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/me` - Get current user profile

**User Management** (Admin/Manager only)
- `GET /api/v1/users` - List users with pagination
- `POST /api/v1/users` - Create new user
- `GET /api/v1/users/:id` - Get user details
- `PATCH /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Soft delete user

**Roles & Permissions** (Admin only)
- `GET /api/v1/roles` - List all roles
- `POST /api/v1/roles/:id/permissions` - Assign permissions to role
- `GET /api/v1/permissions` - List all permissions

### **Available Scripts**

| Command | Description |
|---------|-------------|
| `pnpm setup` | 🚀 **One-click setup for new developers** |
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start Next.js web app only |
| `pnpm dev:backend` | Start NestJS API server only |
| `pnpm build` | Build all applications for production |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm lint:fix` | Auto-fix ESLint issues |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm db:generate` | Generate Prisma client from schema |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:reset` | Reset database and run migrations |
| `pnpm db:seed` | Seed database with initial data |
| `pnpm db:studio` | Open Prisma Studio (database GUI) |
| `pnpm storybook` | Start Storybook for UI components |

## 🎨 Brand Guidelines

### **Colors**
- **Primary**: Wild Strawberry `#ff48b0`
- **Secondary**: Pink Chalk `#f5b1cc`
- **Neutrals**: Professional grays for text and backgrounds

### **Typography**
- **Headings**: Prettywise Bold (fallback: Gotham, Bebas Neue)
- **Body**: Century Gothic (fallback: Poppins)

### **Design Principles**
- **Minimalism**: Clean, uncluttered interfaces
- **Glassmorphism**: Semi-transparent elements with blur effects
- **Accessibility**: WCAG 2.1 AA compliance
- **Responsive**: Mobile-first responsive design

## 🗃️ Database Schema

### **Key Entities**

#### **Users & Authentication**
- `users` - User accounts with NestJS JWT authentication
- `people` - Personal information (names, contacts)
- `employees` - Staff members with roles and branches
- `customers` - Customer profiles and preferences

#### **RBAC (Role-Based Access Control)**
- `roles` - Admin, Manager, Sales Rep, Cashier, etc.
- `permissions` - Granular access control
- `user_roles` - User-role assignments per branch
- `role_permissions` - Role-permission mappings

#### **Products & Inventory**
- `categories` - Hierarchical product categorization
- `products` - Main product catalog
- `product_variants` - SKUs, pricing, and attributes
- `stock_levels` - Current inventory per location
- `stock_movements` - Audit trail of inventory changes

#### **Sales & Orders**
- `orders` - Sales transactions
- `order_items` - Line items with pricing and taxes
- `payments` - Payment processing records

#### **Locations & Geography**
- `branches` - Store locations
- `locations` - Warehouses and storage areas
- `addresses` - Geographic information with Colombian regions

### **Soft Delete Strategy**
All tables implement soft delete with:
- `is_deleted` boolean flag
- `deleted_at` timestamp
- Prisma middleware automatically filters deleted records
- Audit trail preserved for compliance

## 🔐 Authentication & Authorization

### **Authentication Flow**
1. **Sign Up/Sign In**: Custom NestJS Auth with email/password
2. **Session Management**: JWT access + refresh tokens
3. **Role Assignment**: Users assigned roles per branch via RBAC
4. **Permission Checking**: NestJS Guards with `@Roles()` and `@Permissions()` decorators

### **User Roles**

| Role | Permissions | Description |
|------|-------------|-------------|
| **Admin** | All permissions | System administrators |
| **Store Manager** | Store operations, inventory, reports | Branch managers |
| **Sales Rep** | Sales, customers, basic inventory | Sales representatives |
| **Cashier** | POS operations, customer lookup | Cashiers and POS operators |
| **Inventory Manager** | Product and stock management | Inventory specialists |

### **API Security**
NestJS backend security features:
- JWT authentication with refresh token rotation
- Role-based access control (RBAC) with Guards
- Input validation with class-validator
- SQL injection protection via Prisma ORM
- CORS configuration for frontend apps

## 🧪 Testing Strategy

### **Unit Testing**
- **Framework**: Vitest
- **Coverage**: Components, hooks, utilities
- **Location**: `*.test.{ts,tsx}` files alongside source

### **Integration Testing**
- **Framework**: Playwright
- **Coverage**: User flows, API integration
- **Location**: `tests/` directory in each app

### **Component Testing**
- **Framework**: Storybook + Chromatic
- **Coverage**: UI components in isolation
- **Location**: `*.stories.{ts,tsx}` files

## 🚀 Deployment

### **Web Application (Vercel)**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod
```

### **Backend API (Railway/Render/Digital Ocean)**
```bash
# Build for production
pnpm build

# Deploy backend API (example with Railway)
railway login
railway add
railway up
```

### **Database (PostgreSQL Cloud)**
1. Create PostgreSQL database (PostgreSQL, AWS RDS, Supabase, Neon, etc.)
2. Run migrations: `pnpm db:migrate`
3. Seed initial data: `pnpm db:seed`
4. Update `DATABASE_URL` in production environment

## 🤝 Contributing

### **Development Workflow**
1. Create feature branch from `main`
2. Make changes following coding standards
3. Run tests: `pnpm test`
4. Submit pull request with description

### **Coding Standards**
- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Enforce consistent code style
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Semantic commit messages

### **Pull Request Process**
1. Ensure all tests pass
2. Update documentation if needed
3. Request review from maintainers
4. Address feedback and merge

## 📈 Performance

### **Web Performance**
- **Core Web Vitals**: Optimized for LCP, FID, CLS
- **Code Splitting**: Route-based and component-based
- **Image Optimization**: Next.js Image component with optimization
- **Caching**: Aggressive caching strategy with React Query

## 🔧 Troubleshooting

### **Common Issues**

**Database Connection Issues**
```bash
# Check database connection
pnpm db:studio

# Regenerate Prisma client
pnpm db:generate

# Reset and re-migrate database
pnpm db:reset
```

**Backend API Issues**
```bash
# Check API health
curl http://localhost:3001/api

# View API documentation
open http://localhost:3001/api/docs

# Check server logs
pnpm dev:backend
```

**Build Issues**
```bash
# Clear all caches
pnpm clean

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

## 📚 Documentation

- **API Documentation**: `/docs/api/`
- **Component Storybook**: `pnpm storybook`
- **Database Schema**: `/docs/database/`
- **Deployment Guide**: `/docs/deployment/`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Design Inspiration**: Modern beauty industry standards
- **Technology Stack**: Built on proven, scalable technologies
- **Community**: Open source libraries and frameworks

---

**Built with ❤️ for the beauty industry**

For support, please open an issue in the GitHub repository or contact the development team.
