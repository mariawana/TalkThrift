# TalkThrift — owner-managed thrift store

A Next.js starter for a thrift shop where i alone publishing product listings. The catalog starts empty: there are no demo or sample products. Customers can browse available items, but must sign up or log in before checkout. Sign-up collects full name, contact number, delivery address, email, and password. Customers can submit an order request and see a confirmation page. The owner uses the private `/admin` dashboard to manage listings.

## Included
- Responsive storefront with search and category filters
- Empty catalog by default, with a friendly empty-state message
- Supabase Auth customer sign-up and login
- Customer details collected during sign-up and confirmed at checkout
- Cart persists in the browser while navigating to checkout
- Checkout rechecks that products remain available and submits an order with pending status
- Supabase PostgreSQL tables and Row Level Security policies for products, profiles, and orders
- Owner-only product management in `/admin`

## Important before launch
This is a starter implementation. It submits an order request but does not charge online payments, calculate shipping automatically, send notifications, or guarantee inventory locking for simultaneous orders. COD is treated as a request pending owner confirmation, not a fully integrated payment system. Before accepting real orders, add server-side stock locking/validation, order management in the admin dashboard, delivery and payment rules, and privacy/terms pages. Never put a Supabase service-role key in browser code.

## 1. Set up Supabase
1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run the complete `supabase/schema.sql` file.
3. Open **Project Settings → API** and copy the Project URL and publishable/anon key.
4. Configure email confirmation under **Authentication → Providers → Email** to match how you want sign-ups verified.
5. Sign up using your own owner email in the deployed/local `/account` page (or create the user through Supabase Auth).
6. In SQL Editor, promote only your own account by replacing the email below and running it:

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users where lower(email) = lower('YOUR_OWNER_EMAIL'));
```

Do not give customers owner access. New sign-ups are assigned the `customer` role automatically.

## 2. Run locally
1. Install Node.js LTS from https://nodejs.org.
2. Extract the ZIP and open the `talkthrift` folder in VS Code.
3. Copy `.env.example` to `.env.local` and fill in the Supabase Project URL and publishable/anon key.
4. In the project terminal, run:

```bash
npm install
npm run dev
```

5. Open `http://localhost:3000` for the shop, `http://localhost:3000/account` for customer sign-up/login, and `http://localhost:3000/admin` for the owner dashboard.

## 3. Deploy on Vercel
1. Create a GitHub repository and upload the contents of this folder.
2. Sign in at https://vercel.com and choose **Add New → Project**.
3. Import your GitHub repository; Vercel should detect Next.js automatically.
4. Add these Environment Variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase publishable/anon key
5. Deploy and test the generated `.vercel.app` URL.
6. In Supabase Authentication URL configuration, add your deployed site URL to **Site URL** and add the deployed URL to **Redirect URLs**.

## 4. Add your first product
1. Open `https://YOUR-SITE.vercel.app/admin`.
2. Sign in with your owner account after promoting its profile role to `owner` in SQL.
3. Add the product name, category, size, condition, price, image URL, and description.
4. Publish it; it will then appear in the storefront.
5. Mark sold items as sold so customers cannot browse them as available.

## Current checkout behavior
- Visitors may browse without an account.
- Customers must sign up/log in before checkout.
- Checkout collects and confirms name, phone, and delivery address.
- An order is stored with `pending` status for owner confirmation.
- Shipping fee/payment details are not automatically calculated or charged. Confirm those with customers until a real shipping/payment workflow is implemented.

## Product images
The starter accepts an image URL. For production, configure Supabase Storage and an upload workflow so you can upload photos directly from your device. Use only photos you own or have permission to use.
