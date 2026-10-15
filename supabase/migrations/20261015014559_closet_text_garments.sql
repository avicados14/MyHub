-- Text-only garments share the existing owner/session RLS and immutable numbering.
-- No data is deleted; existing photographed garments satisfy the stronger paired constraint.
alter table public.wardrobe_items alter column image_path drop not null;
alter table public.wardrobe_items alter column content_hash drop not null;
alter table public.wardrobe_items add constraint wardrobe_photo_pair check (
 (image_path is null and content_hash is null and dhash is null)
 or (image_path is not null and content_hash is not null)
);
alter table public.wardrobe_items add column garment_type text not null default 'unknown'
 check (garment_type in ('unknown','short-sleeve','long-sleeve','sweatshirt','tank','shorts','pants','jacket','shoes','accessory','one-piece'));
alter table public.wardrobe_items add column preference text not null default 'normal'
 check (preference in ('preferred','normal','avoid'));
