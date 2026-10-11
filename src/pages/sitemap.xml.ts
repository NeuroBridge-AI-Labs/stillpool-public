import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const HOST = 'https://learn.neurobridgeedu.eu';
const INFO = ['about', 'teachers', 'lab', 'feedback', 'help', 'accessibility', 'privacy', 'terms', 'licences', 'notices'];

// Indexable pages only: not /search/, not /done/**. Only a lesson has a real date (provenance.date).
export const GET: APIRoute = async () => {
  const url = (path: string, lastmod = '') => `<url><loc>${HOST}${path}</loc>${lastmod && `<lastmod>${lastmod}</lastmod>`}</url>`;
  const lessons = (await getCollection('lessons')).sort((a, b) => a.id.localeCompare(b.id));
  const urls = [
    url('/'),
    ...lessons.map((l) => url(`/learn/${l.id}/`, l.data.provenance.date.toISOString().slice(0, 10))),
    ...INFO.map((p) => url(`/${p}/`)),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
