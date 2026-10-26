# 🚀 RestoFlow — Restaurant Management & POS System

RestoFlow is a full-featured **Restaurant Management & Point of Sale (POS) System** designed to manage core restaurant operations through a centralized and modern web application.

The project was designed and developed using **Google Antigravity**, with **ChatGPT** used as an AI-assisted development partner for requirements analysis, prompt engineering, debugging, solution review, performance optimization, and technical problem-solving.

## 🎯 Project Overview

RestoFlow provides an integrated platform for managing:

* 📊 Dashboard & KPIs
* 🛒 Point of Sale (POS) & Checkout
* 🍔 Products & Menu Management
* 👥 Customer Management
* 📦 Inventory Management
* 🧾 Orders Management
* 🚚 Suppliers
* 🪑 Tables
* 📈 Analytics & Reports
* 🔐 Authentication & Role-Based Access
* 🖼️ Product Image Upload & Storage

## 🛠️ Technologies & Tools

### Frontend

* React
* TypeScript
* Vite
* React Context API
* Lazy Loading
* Code Splitting

### Backend & Database

* Supabase
* PostgreSQL
* Supabase Authentication
* Supabase Storage
* Database Relationships & Foreign Keys

### Performance

* Client-side Caching
* Targeted Cache Updates
* `useMemo`
* `useCallback`
* Lazy Loading
* Manual Vendor Chunking

### Development & Deployment

* Google Antigravity
* ChatGPT
* Git
* GitHub
* Vercel
* Browser DevTools

## 💡 Key Challenges & Solutions

### Customer Deletion & Data Integrity

One of the main challenges was handling customer deletion when customers were linked to historical orders through foreign-key relationships.

The solution required distinguishing between customers with no order history, who can be safely deleted, and customers with historical transactions, whose data should be preserved to maintain database integrity and business history.

### Order Cancellation & Inventory

Cancelled orders are not simply deleted.

The system preserves historical order records while handling the appropriate inventory restoration process.

This ensures:

**Cancel ≠ Delete**

### Product Image Management

Product images were integrated using **Supabase Storage**, allowing users to upload images and associate them with products while storing the image reference rather than the actual file inside the database.

### Performance Optimization

The system was optimized to reduce unnecessary database requests and UI updates.

Instead of refetching an entire orders list after updating a single order, the relevant record can be updated directly within the local cache.

Additional optimizations include:

* `useMemo`
* `useCallback`
* Lazy Loading
* Code Splitting
* Vendor Chunking
* Targeted Cache Updates

### Production Debugging

During deployment, the application initially displayed a white screen in production.

Browser DevTools helped identify missing Supabase environment variables. After configuring the required production environment variables and redeploying, the application successfully went live.

## 🧪 Testing & Validation

The application was tested across major workflows including:

* Authentication
* Customer CRUD
* Customer deletion
* Products & Menu
* Product image upload
* Orders
* Order cancellation/refund
* Inventory
* POS & Checkout
* Dashboard
* Analytics
* Refresh & re-login flows

The project also passed TypeScript checks and production builds before deployment.

## 🚀 Development & Deployment Workflow

```text
Business Analysis
        ↓
Requirements Definition
        ↓
UI & System Development
        ↓
Supabase Integration
        ↓
Testing & Debugging
        ↓
Performance Optimization
        ↓
Git & GitHub
        ↓
Vercel Deployment
        ↓
Production
```

## 🤖 AI-Assisted Development

A major part of this project was using AI to accelerate development.

**Google Antigravity** was used for system design and implementation, while **ChatGPT** supported:

* Requirements analysis
* Prompt engineering
* Debugging
* Error investigation
* Code review
* Architecture discussions
* Performance optimization
* Technical problem solving

The goal was not simply to generate code, but to understand the reasoning behind the implementation and validate the resulting solutions.

## 🔗 Live Demo

**RestoFlow:**
https://reto-flow-erp.vercel.app/

## 💼 Portfolio

**Mohammed Hamza — Data Analytics Portfolio:**

 https://mohammed-hamza-pro.lovable.app/

## 👨‍💻 Author

**Mohammed Hamza**
Data Analyst | BI Analyst | AI-Assisted Development

---

⭐ If you find this project useful or interesting, feel free to explore the repository and share your feedback.
