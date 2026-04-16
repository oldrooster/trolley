IMPROVEMENTS:
1. Allow drag and drop to upload invoices for receipt uploader
2. All Ingredients should have to things
   * unit type, that is how it is typically measured. e.g. grams (e.g. 100g of Butter), mls (250mls of milk) , or each (one onion)
   * This is the type that should be used when creating a list
3. Look at existing Markdown around different unit type conversions in recipes. I want to use AI here to help where
   * When adding/editing a recipe, on save it should look at the unit types specified in the recipe,
   * Where they don't match the unit type of an ingredient, use AI to do a converstion to approximate what these should be, e.g. a dash of olive oil, a cup of milk etc..
   * Show on screen what these conversions are so the user can override if they don't agree, then save changes.
   * When a user adds a meal to the list, it should use this conversion to ensure consistancy of ordering

KNOWN ISSUES
1. On main page once loaded (through caddy) these errors appear -IGNORE CLAUDE THIS IS INCASE I WANT TO FIX IT IN CLOUDFLARE
 ``` Go to Cloudflare Zero Trust → Access → Applications → trolley.cbf.nz
    Add a bypass rule (or "skip" policy) for these paths:
    /manifest.json
    /favicon.svg
    /favicon.ico
    /assets/*
    ```
