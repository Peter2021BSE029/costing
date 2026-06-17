# Costing System for Uganda Printing and Publishing Corporation

This is a full-stack costing system built with Node.js backend, PostgreSQL database, and a web frontend.

## Features

- ✅ **Database Setup**: PostgreSQL with complete schema for costing system
- ✅ **Client Management**: Add and view clients with margin tiers
- ✅ **Job Management**: Create jobs linked to clients with comprehensive cost tracking
- ✅ **Admin Interface**: Full CRUD operations for materials, machines, and other entities
- ✅ **Margin Tiers**: Configured for different client types (Government 15%, NGO 20%, Commercial 30%, Internal 0%)
- ✅ **Cost Calculation**: Complete framework for materials, machines, bindings, special processes
- ✅ **Quotation Generation**: PDF quotation generation with detailed cost breakdowns
- ✅ **API Endpoints**: RESTful API for all entities with proper error handling
- ✅ **Reporting**: Structure in place for cost breakdowns and totals

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
- `job_additional_costs` - Design, typesetting, storage, transport, overhead costs
- `system_settings` - VAT (18%) and overhead percentages

## Deployment

### Local Development
1. Set up PostgreSQL database and run schema
2. Configure `.env` file
3. Run `npm start`
4. Access at `http://127.0.0.1:3000/`

### Server Deployment
1. Set up PostgreSQL on your server
2. Update `.env` with server database credentials
3. Set `HOST=0.0.0.0` to allow external connections
4. Run `npm start`
5. Access at `http://your-server-ip:3000/`

### Environment Variables
```env
DB_HOST=localhost          # Database server host
DB_PORT=5432              # Database port
DB_NAME=costing_db        # Database name
DB_USER=your_username     # Database user
DB_PASS=your_password     # Database password
JWT_SECRET=change_me      # Long random token signing secret
PORT=3000                 # Server port
HOST=127.0.0.1            # Server host (use 0.0.0.0 for external access)
```

### URLs
- **Main Application**: `http://<host>:<port>/`
- **Admin Interface**: `http://<host>:<port>/admin.html`
- **API Base**: `http://<host>:<port>/api`

## Usage

### Main Application
- Navigate through the wizard to create costing jobs
- Save sections individually or complete jobs
- View recent jobs and generate quotations

### Admin Interface
- Access `frontend/admin.html` for managing materials and machines
- Add, edit, and delete materials with unit costs
- Add, edit, and delete machines with cost per impression
- All changes are protected by foreign key constraints

### API Endpoints
- `GET /api/clients` - List all clients
- `GET /api/jobs` - List all jobs
- `GET /api/materials` - List all materials
- `GET /api/machines` - List all machines
- `POST /api/costing` - Create new costing job
- `GET /api/costing/quotation/:jobId` - Generate PDF quotation
- `POST/PUT/DELETE /api/materials/:id` - CRUD operations for materials
- `POST/PUT/DELETE /api/machines/:id` - CRUD operations for machines

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **PDF Generation**: PDFKit
- **Styling**: Custom CSS with responsive design

## Project Structure

```
project/
├── backend/
│   ├── routes/
│   │   ├── costing.js
│   │   ├── materials.js
│   │   ├── machines.js
│   │   └── ...
│   └── server.js
├── frontend/
│   ├── index.html
│   ├── admin.html
│   ├── js/
│   │   ├── app.js
│   │   └── admin.js
│   └── css/
│       └── style.css
├── database/
│   ├── schema.sql
│   └── add_plates.sql
├── package.json
└── README.md
```

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
