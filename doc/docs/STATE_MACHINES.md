# State Machines --- Quotation Engine

## Quotation State Machine

``` text
          +---------+
          |  DRAFT  |
          +----+----+
               |
            submit
               v
        +-------------+
        |  SUBMITTED  |
        +-------------+
```

### DRAFT

Allowed: - add item - update item - delete item - recalculate - save -
submit

### SUBMITTED

Allowed: - read - recalculate only if the business model permits
recalculation without changing commercial inputs

Not allowed: - add/update/delete items

## Invalid Transitions

-   SUBMITTED → DRAFT is not allowed by default.
-   DRAFT → APPROVED is not allowed without submission.
-   Any unknown status transition must fail closed.

## UI States

-   Loading
-   Empty
-   Editing
-   Saving
-   Save failed
-   Validation error
-   Submitted
