import Link from 'next/link'

const ENTRIES = [
  {
    version: 'v0.9',
    date:    'Jun 2026',
    title:   'Integração com Steam e correções de layout',
    items: [
      'Campo Steam ID no perfil para conectar sua conta Steam',
      'Banner "Jogando agora 🎮" exibido no perfil quando o usuário está em uma partida',
      'Seção "Jogos recentes" com os últimos 3 jogos e tempo de jogo total',
      'Status atualizado automaticamente a cada 60 segundos no perfil',
      'API route server-side para proteger a chave Steam (sem expor no cliente)',
      'Capas de "Assistindo agora" e "Lendo agora" com fallback quando não há imagem disponível',
      'Layout do perfil corrigido no mobile: conteúdo ocupa a largura total da tela',
    ],
  },
  {
    version: 'v0.8',
    date:    'Jun 2026',
    title:   'AniList e favoritos no perfil',
    items: [
      'Busca de anime e manga via AniList com toggle Anime/Manga no compositor de posts',
      'Cover art do anime/manga preenchida automaticamente como imagem do post',
      'Campo "Anime favorito" no perfil com capa exibida na página de perfil',
      'Modal de busca com debounce de 500ms, cache de 10 entradas e mensagem amigável para rate limit',
    ],
  },
  {
    version: 'v0.7',
    date:    'Jun 2026',
    title:   'Busca de filmes, séries e livros',
    items: [
      'Integração com TMDB: busca de filmes e séries direto no compositor de posts',
      'Integração com Google Books: busca de livros no compositor com chave de API',
      'Pôster ou capa preenchidos automaticamente como imagem do post',
      'Campos "Assistindo agora" e "Lendo agora" na edição de perfil com cards no perfil público',
      'Modal de busca de mídia reutilizável com debounce e cache compartilhado',
    ],
  },
  {
    version: 'v0.6',
    date:    'Mai 2026',
    title:   'Last.fm, temas e qualidade de vida',
    items: [
      'Integração com Last.fm: botão "Ouvindo agora" preenche o post com faixa atual',
      'Widget de músicas recentes na página de perfil',
      'Tema claro/escuro com toggle na nav mobile e na tela de login',
      'Badge de notificações atualizado instantaneamente ao marcar todas como lidas',
      'Câmera frontal e traseira no compositor de posts',
      'Validação de email e usuário duplicados no cadastro',
      'Opção de excluir conta com confirmação',
    ],
  },
  {
    version: 'v0.5',
    date:    'Abr 2026',
    title:   'Incelicar, hashtags e Explorar',
    items: [
      'Incelicar: repost com comentário opcional (quote repost)',
      'Hashtags por categoria: #Anime, #BBB, #Música, #Série, #Filme, #Livro',
      'Página Explorar com filtros por hashtag e posts em destaque',
      'Contagem de reposts exibida nos posts',
    ],
  },
  {
    version: 'v0.4',
    date:    'Mar 2026',
    title:   'Stories',
    items: [
      'Stories com expiração automática de 24 horas',
      'Barra de stories com avatares no topo do feed',
      'Visualização em tela cheia com barra de progresso e navegação por toque',
      'Marcar stories como vistos e deletar os próprios stories',
      'Gradiente animado no avatar quando há story ativo',
    ],
  },
  {
    version: 'v0.3',
    date:    'Fev 2026',
    title:   'Comentários e notificações',
    items: [
      'Sistema de comentários com respostas aninhadas e curtidas',
      'Central de notificações com badge de não lidas em tempo real',
      'Polling de 15s + atualização instantânea via evento customizado',
      'Textos de notificação no estilo incelicas ("te incelicou", "derramou o chá"…)',
    ],
  },
  {
    version: 'v0.2',
    date:    'Jan 2026',
    title:   'Vibe Check e perfis',
    items: [
      'Vibe Check: 5 reações únicas — Serving 🔥, Morrei 💀, Iconic 👑, Chá ☕, No Hype 🌊',
      'Páginas de perfil com avatar, bio, stats e grid de posts',
      'Seguir e deixar de seguir usuários com contagem em tempo real',
      'Modal de lista de seguidores e seguindo',
      'Badge de verificado para membros especiais',
    ],
  },
  {
    version: 'v0.1',
    date:    'Dez 2025',
    title:   'Feed inicial',
    items: [
      'Feed principal com posts de texto, imagem, GIF e vídeo',
      'Compositor de posts com upload da galeria e câmera',
      'Embed de Spotify e YouTube nos posts',
      'Autenticação com email e senha via Supabase',
      'Sidebar com trending tags e sugestões de quem seguir',
      'Layout responsivo mobile-first com nav inferior',
    ],
  },
]

const COMING_SOON = [
  'Mensagens diretas entre usuários',
  'Editar post após publicar',
  'Busca de posts e conteúdo',
  'Notificações push (Web Push API)',
  'Salvar posts para ver depois',
  'PWA — instalar como app no celular',
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-8">
          <Link href="/feed" className="text-xs text-zinc-600 transition-colors hover:text-zinc-400">
            ← Voltar ao feed
          </Link>
          <p className="mt-4 text-2xl font-black tracking-tight">
            <span className="text-[#D4537E]">Incelicas</span>
          </p>
          <h1 className="mt-1 text-lg font-semibold text-zinc-300">
            O que tem de novo
          </h1>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-0 w-px bg-zinc-800" aria-hidden />

          <div className="space-y-0">
            {ENTRIES.map((entry, i) => (
              <div key={entry.version} className="relative pb-6 pl-10">
                {/* Dot */}
                <div className={[
                  'absolute left-0 flex h-7 w-7 items-center justify-center rounded-full border',
                  i === 0
                    ? 'border-[#D4537E] bg-[#D4537E]/20'
                    : 'border-zinc-700 bg-zinc-900',
                ].join(' ')}>
                  <div className={[
                    'h-2 w-2 rounded-full',
                    i === 0 ? 'bg-[#D4537E]' : 'bg-zinc-600',
                  ].join(' ')} />
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={[
                      'rounded-full px-2.5 py-0.5 text-xs font-bold',
                      i === 0
                        ? 'bg-[#D4537E]/20 text-[#D4537E]'
                        : 'bg-zinc-800 text-zinc-400',
                    ].join(' ')}>
                      {entry.version}
                    </span>
                    <span className="text-xs text-zinc-600">{entry.date}</span>
                  </div>
                  <h2 className="mb-2.5 text-sm font-semibold text-zinc-100">{entry.title}</h2>
                  <ul className="space-y-1.5">
                    {entry.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-zinc-400">
                        <span className="mt-0.5 flex-shrink-0 text-[#7F77DD]">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Em breve */}
        <div className="mt-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            ✨ Em breve
          </h2>
          <ul className="space-y-2">
            {COMING_SOON.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                <span className="mt-0.5 flex-shrink-0 text-[#1D9E75]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-zinc-600">
          <Link href="/status" className="transition-colors hover:text-zinc-400">
            ← Status do sistema
          </Link>
          <Link href="/feed" className="transition-colors hover:text-zinc-400">
            Voltar ao feed →
          </Link>
        </div>

      </div>
    </div>
  )
}
