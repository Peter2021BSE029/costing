# Costing System for Uganda Printing and Publishing Corporation

This is a full-stack costing system built with Node.js backend, PostgreSQL database, and a web frontend.

## Features

- ✅ **Database Setup**: PostgreSQL with complete schema for costing system
- ✅ **Client Management**: Add and view clients with margin tiers
- ✅ **Job Management**: Create jobs linked to clients
- ✅ **Margin Tiers**: Configured for different client types (Government 15%, NGO 20%, Commercial 30%, Internal 0%)
- ✅ **API Endpoints**: RESTful API for all entities
- 🔄 **Cost Calculation**: Framework ready for materials, machines, bindings, special processes
- 🔄 **Reporting**: Structure in place for cost breakdowns and totals

## Database Schema

**Tables Created:**
- `users` - System users
- `margin_tiers` - Client margin categories
- `clients` - Client information with margin tier links
- `jobs` - Print jobs linked to clients
- `materials` - Paper, ink, glue, etc. with costs
- `machines` - Printing equipment with costs
- `bindings` - Binding methods and rates
- `special_processes` - Perforation, collating, etc.
- `job_materials`, `job_machines`, `job_bindings`, `job_special_processes` - Job cost components
- `job_costs` - Additional costs (design, transport, etc.)
- `system_settings` - VAT (18%) and overhead percentages

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL Database:**
   - Install PostgreSQL
   - Update `.env` with your credentials
   - Run the schema: `psql -U postgres -h localhost -p 5432 -f database/schema.sql`

3. **Start the Application:**
   ```bash
   npm start
   ```

4. **Open Frontend:**
   - Open `frontend/index.html` in your browser
   - Server runs on `http://127.0.0.1:3000`

## API Endpoints

- `GET /api/test` - Test database connection
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `GET /api/clients/margin-tiers` - Get margin tiers
- `GET /api/jobs` - Get all jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs/clients` - Get clients for job creation

## Usage

1. **Test Database**: Click "Test Database" to verify connection
2. **Add Clients**: Use "Add Client" form with margin tier selection
3. **View Clients**: Click "Load Clients" to see all clients
4. **Add Jobs**: Use "Add Job" form linked to existing clients
5. **View Jobs**: Click "Load Jobs" to see all jobs with client details

## Next Steps

- Add materials, machines, and binding management
- Implement cost calculation logic
- Add job costing breakdown views
- Create reports and export functionality
- Add user authentication

## Technologies

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **API**: RESTful JSON API

## Notes

- This is a basic scaffold. Customize according to specific requirements.
- The prototype should be integrated or referenced for UI/UX.