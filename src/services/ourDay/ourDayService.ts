import { OurDayPhoto } from '../../types/models';
import { supabase, supabaseConfig } from '../api/supabaseClient';

class OurDayService {
  /**
   * Save a single photo to "Наш день"
   */
  async addPhoto(
    pairId: string,
    authorId: string,
    authorName: string,
    imageUrl: string,
    caption?: string | null
  ): Promise<OurDayPhoto> {
    const photo: OurDayPhoto = {
      id: `ourday-${pairId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      pairId,
      authorId,
      authorName,
      imageUrl,
      createdAt: new Date().toISOString(),
      caption: caption || null,
    };

    // Attempt background sync to Supabase if configured
    if (supabaseConfig.isConfigured && pairId) {
      try {
        await supabase.from('our_day_photos').insert([
          {
            id: photo.id,
            pair_id: pairId,
            author_id: authorId,
            author_name: authorName,
            image_url: imageUrl,
            created_at: photo.createdAt,
            caption: photo.caption,
          },
        ]);
      } catch (err) {
        console.warn('[OurDayService] Supabase insert warning (saved locally):', err);
      }
    }

    return photo;
  }

  /**
   * Save multiple photos at once
   */
  async addMultiplePhotos(
    pairId: string,
    authorId: string,
    authorName: string,
    imageUrls: string[]
  ): Promise<OurDayPhoto[]> {
    const photos: OurDayPhoto[] = [];
    for (const url of imageUrls) {
      const p = await this.addPhoto(pairId, authorId, authorName, url);
      photos.push(p);
    }
    return photos;
  }

  /**
   * Fetch photos for a pair from Supabase if online
   */
  async fetchRemotePhotos(pairId: string): Promise<OurDayPhoto[]> {
    if (!supabaseConfig.isConfigured || !pairId) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('our_day_photos')
        .select('*')
        .eq('pair_id', pairId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        pairId: row.pair_id,
        authorId: row.author_id,
        authorName: row.author_name || 'Партнёр',
        imageUrl: row.image_url,
        createdAt: row.created_at,
        caption: row.caption,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Delete a photo by ID
   */
  async deletePhoto(photoId: string, pairId: string): Promise<boolean> {
    if (supabaseConfig.isConfigured && pairId) {
      try {
        await supabase
          .from('our_day_photos')
          .delete()
          .eq('id', photoId)
          .eq('pair_id', pairId);
      } catch (err) {
        console.warn('[OurDayService] Supabase delete warning:', err);
      }
    }
    return true;
  }
}

export const ourDayService = new OurDayService();
