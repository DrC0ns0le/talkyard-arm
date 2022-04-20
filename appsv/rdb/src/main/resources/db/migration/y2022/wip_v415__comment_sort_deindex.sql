
-- Bits 1-4:  0 = oldest fisrt, 1 = newest,
-- 3 = best first, trending = 4, 5 controversial first, 13 = problematic first, 
-- Bits 5-8: Same but for nesting depth 2 ?
-- Bits 9-12: Same but for nesting depth 3 ?
-- Bits 13-16 unused?
--
-- Later, instead in: disc_view_t, see [disc_props_view_stats]
--
alter table pages3      add column disc_post_sort_order_c i32_d;

-- The defaut for all pages in this cat and sub cats:
alter table categories3 add column disc_post_sort_order_c i32_d;


-- De-prioritizes this page (or sub thread) among the search results.
-- Say, a question or idea about something, before there were any docs
-- — and later on, docs are written, and the original question is no longer
-- that interesting (because the docs are shorter and better).

-- null = 0 = default.
-- 1 = deprioritize this post only (not impl),
-- -5 deprioritize whole page or thread.
alter table posts3 add column index_prio_c i16_d;

