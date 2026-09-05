# One Important Architectural Adjustment

There is one thing that should **not** be done from the original
simplistic design:

Don't make five completely separate authentication systems.

Don't create:
- `customer_auth`
- `sales_rep_auth`
- `manager_auth`
- `admin_auth`
- `finance_auth`

Instead:

```text
              users
                |
  +------+------+------+------+
  |      |      |      |      |
CUSTOMER SALES_REP SALES_MANAGER FINANCE_OPERATIONS ADMIN
```

One `users` table, one `role` column, five flat values
(see `auth_domain_model.md` for the full UserRole enum).
No per-role hierarchy or grouping exists in the schema.

**One authentication system. Multiple roles.**
