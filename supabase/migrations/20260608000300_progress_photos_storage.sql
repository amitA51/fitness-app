-- ============================================================
-- PROGRESS PHOTOS — private Storage bucket for check-in photos.
-- Path convention: {user_id}/{check_in_id}/{uuid}.webp
-- Owner uploads/reads/deletes own photos; an ACTIVE coach (is_coach_of)
-- can read them. check_ins.photos JSONB (already exists) stores the refs.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progress-photos',
    'progress-photos',
    false,
    5242880, -- 5MB
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Write only into your own top-level folder.
DROP POLICY IF EXISTS "progress_photos_insert_own" ON storage.objects;
CREATE POLICY "progress_photos_insert_own" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'progress-photos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- Read: owner, or the owner's active coach.
DROP POLICY IF EXISTS "progress_photos_select_own_or_coach" ON storage.objects;
CREATE POLICY "progress_photos_select_own_or_coach" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'progress-photos'
        AND (
            (storage.foldername(name))[1] = (SELECT auth.uid())::text
            OR public.is_coach_of(((storage.foldername(name))[1])::uuid)
        )
    );

-- Delete: owner only.
DROP POLICY IF EXISTS "progress_photos_delete_own" ON storage.objects;
CREATE POLICY "progress_photos_delete_own" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'progress-photos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
