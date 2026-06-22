export type SystemStatus = 'operational' | 'maintenance' | 'degraded'

// ─── Change this to update the status badge site-wide ────────────────────────
export const CURRENT_STATUS: SystemStatus = 'operational'

// ─── Add / remove bugs here. After changes, create an official post. ────────
// See CLAUDE.md for the exact post format and curl command.
export const KNOWN_BUGS: string[] = [
  'Upload de vídeo pode falhar em conexões lentas — se o post não aparecer, tente de novo.',
  'Câmera frontal no iOS pode abrir invertida ao usar "Tirar foto" no compositor.',
  'O player do Spotify pode não carregar com bloqueadores de anúncios ativos.',
  'Notificações em tempo real podem levar alguns segundos para aparecer após a ação.',
]
