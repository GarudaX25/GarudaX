# GARUDAX — Website + Online Orders + Admin Panel

This is a GitHub Pages frontend connected to Supabase for database, admin authentication and file storage. It is designed so customers place orders on the website first; WhatsApp is optional after the order is saved.

## Included
- Customer website with printing, photocopy, passport photo and colouring-book catalogue.
- Online order form with customer details, product, sizes/options, quantity, optional document upload and cash/UPI-on-delivery selection.
- Orders saved in Supabase with order number and default `Pending` status.
- Separate password-protected admin page (`admin.html`).
- Admin dashboard to see orders, filter by status, mark confirmed/printing/out-for-delivery/delivered/cancelled, and create secure short-lived links to customer files.
- Product manager to set price, unit, sizes/options, visibility, cover images and upload colouring-book PDFs.
- Supabase Row Level Security policies. No service-role secret is used in browser code.

## Important before launch
1. Create a free Supabase project at https://supabase.com/.
2. Open **SQL Editor**, paste all of `schema.sql`, and run it.
3. In Supabase **Project Settings → API** (or Connect), copy the **Project URL** and the **anon/public key**. Put them in `config.js`.
   - `SUPABASE_URL`: your project URL
   - `SUPABASE_ANON_KEY`: the anon/public key
   - `WHATSAPP_NUMBER`: your number as country code + number, digits only (India example format: `91` followed by 10 digits)
   - Never paste a `service_role` key into this website.
4. Create your admin login in Supabase: **Authentication → Users → Add user**. Use your own email and a strong password.
5. Back in SQL Editor, run this statement after replacing the email with the exact email you created:

   ```sql
   insert into public.garudax_admins (user_id)
   select id from auth.users where email = 'YOUR-ADMIN-EMAIL-HERE'
   on conflict (user_id) do nothing;
   ```

6. Deploy to GitHub Pages. Upload **all files in this folder** to the root of your public repository (including `config.js`, `schema.sql`, and `admin.html`). In GitHub, open **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
7. Open the published site, then open `/admin.html` and sign in with the admin email/password. Add your services, sizes and prices before accepting real orders.
8. Place a test order yourself and confirm it appears in the dashboard. Test file uploads and status updates before sharing the site.

## Where to edit
- `config.js`: Supabase URL/key and WhatsApp number.
- `index.html`: public website content.
- `style.css`: styling and responsive layout.
- `app.js`: catalogue loading and customer order flow.
- `admin.html`, `admin.js`: admin login, orders and product manager.
- `schema.sql`: database tables, policies and storage bucket setup.

## Notes and limitations
- GitHub Pages hosts the frontend only. Supabase is required for orders, login, database and uploads.
- This starter supports cash or UPI payment on delivery; it does not collect online payments.
- WhatsApp is optional. The order is inserted into the database before the optional WhatsApp button appears.
- Admin should verify the order details and amount before confirming, because this static frontend is not a payment processor and customer-provided values should not be treated as verified payment.
- Customer uploaded files are stored in a private bucket and can be opened from the admin dashboard using a temporary signed link. Keep the admin account private and delete documents when no longer needed.
- Public order form can be abused by bots if widely shared. Before large-scale use, add CAPTCHA/rate limiting and consider server-side validation. Never expose secret/service-role credentials.
- Supabase free-plan limits and terms can change; check the current dashboard before relying on it for business-critical orders.
