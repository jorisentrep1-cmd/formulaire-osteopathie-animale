// Envoi d'une photo ou d'un logo vers imgbb, sans exposer la cle dans la page.
// La cle est un secret du projet Cloudflare Pages : IMGBB_KEY (production).
// Copie par formulaires/generer.py dans chaque depot formulaire-* : ne pas modifier dans les depots.
const MAX = 32 * 1024 * 1024;

function json(corps, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  // Le navigateur envoie toujours l'origine sur un POST : on n'accepte que le formulaire lui-meme.
  const origine = request.headers.get('Origin');
  if (!origine || new URL(origine).host !== new URL(request.url).host) return json({ success: false, erreur: 'origine' }, 403);
  if (!env.IMGBB_KEY) return json({ success: false, erreur: 'configuration' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > MAX + 1024 * 1024) return json({ success: false, erreur: 'trop lourd' }, 413);

  let donnees;
  try { donnees = await request.formData(); } catch { return json({ success: false, erreur: 'format' }, 400); }
  const fichier = donnees.get('image');
  if (!fichier || typeof fichier === 'string' || !/^image\//.test(fichier.type) || fichier.size > MAX) {
    return json({ success: false, erreur: 'image attendue' }, 400);
  }

  const envoi = new FormData();
  envoi.append('image', fichier, fichier.name || 'photo.jpg');
  const reponse = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_KEY)}`, { method: 'POST', body: envoi });
  const brut = await reponse.text();
  let resultat = null;
  try { resultat = JSON.parse(brut); } catch {}
  if (!resultat || !resultat.success) {
    // 424 et pas 502 : Cloudflare remplace les 502 par sa propre page et masque la cause.
    const detail = (resultat && resultat.error && resultat.error.message) || brut.replace(/\s+/g, ' ').slice(0, 160);
    console.error('imgbb', reponse.status, detail);
    return json({ success: false, erreur: 'imgbb', statut: reponse.status, detail }, 424);
  }
  return json({ success: true, data: { url: resultat.data.url } });
}

export function onRequest() {
  return new Response('Méthode non autorisée', { status: 405, headers: { Allow: 'POST' } });
}
