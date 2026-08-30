-- Adding an item no longer blocks on classification: the row is inserted
-- immediately (category_id null, classification_status = 'pending') and a
-- background job fills in the classified fields, cutout, category, and any
-- duplicate flags once the AI calls finish. Existing rows were already fully
-- processed under the old synchronous flow, hence the 'done' default.

alter table public.items
  add column classification_status text not null default 'done'
    check (classification_status in ('pending', 'done')),
  add column processing_notices text[],
  add column possible_duplicate_ids uuid[];
