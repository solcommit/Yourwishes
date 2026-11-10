# Five-level item-grade priorities

Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold). Each dropdown entry includes a rank 1–5 and a text description, so color is not the only indicator. Trigger, option and detail badges share the same theme-aware palette.

Apply `202611100003_item_grade_priority.sql` before saving new grades against Supabase. Existing Low → Common, Medium → Rare and High → Legendary records are migrated transactionally; default is Rare. The existing updated_at trigger will update migrated record versions: refresh open clients after migration before editing. Client read normalization keeps old rows readable before migration. Old deployed clients posting Low/Medium/High must be updated with this deployment. SQL has been prepared but not applied here.

UI labels now describe need: Байвал гоё, Авмаар байна, Хэрэгтэй, Маш хэрэгтэй, Нэн шаардлагатай. The five colors and persisted values are unchanged; this label-only revision requires no additional migration.
