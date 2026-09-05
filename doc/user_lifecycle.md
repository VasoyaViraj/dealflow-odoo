```text
User Lifecycle

                 ┌──────────────┐
                 │   CREATED    │
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │    ACTIVE    │
                 └──┬────────┬──┘
                    │        │
             deactivate      suspend
                    │        │
                    ▼        ▼
             ┌──────────┐ ┌───────────┐
             │ INACTIVE │ │ SUSPENDED │
             └────┬─────┘ └─────┬─────┘
                  │              │
                activate       reactivate
                  │              │
                  └──────┬───────┘
                         ▼
                     ACTIVE

Authentication REQUEST

REQUEST
   │
   ▼
VALIDATE
   │
   ├── invalid ──→ REJECT
   │
   ▼
FIND USER
   │
   ├── not found ──→ REJECT
   │
   ▼
CHECK STATUS
   │
   ├── inactive/suspended ──→ REJECT
   │
   ▼
VERIFY PASSWORD
   │
   ├── invalid ──→ REJECT
   │
   ▼
AUTHENTICATED
   │
   ▼
ISSUE TOKENS
```
