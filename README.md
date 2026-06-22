# incelicas

> Rede social completa desenvolvida do zero como projeto de estudo em desenvolvimento web fullstack.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square)

## Sobre o projeto

Incelicas é uma rede social temática desenvolvida para um grupo de amigos apaixonados por cultura pop — anime, BBB, música, séries, filmes e livros. O projeto nasceu como um desafio pessoal de aprender desenvolvimento web fullstack construindo algo real e funcional do zero.

A proposta foi criar uma plataforma com identidade própria: em vez de curtidas genéricas, o sistema de **Vibe Check** permite reagir com emojis temáticos. Em vez de "republicar", os usuários **incelicam** os posts. Cada detalhe da linguagem e das notificações foi pensado para refletir a personalidade do grupo.

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Estilização | Tailwind CSS |
| Deploy | Vercel |
| Armazenamento | Supabase Storage |
| Tempo real | Supabase Realtime |

## Funcionalidades

### Feed e posts
- Criação de posts com texto, imagem, GIF e vídeo
- Embed automático de músicas do Spotify e vídeos do YouTube
- Busca e inserção de filmes via TMDB com pôster automático
- Busca e inserção de livros via Google Books com capa automática
- Busca e inserção de animes via AniList com capa automática
- Hashtags livres com trending dinâmico das últimas 24 horas
- Feed filtrado por hashtag
- Scroll infinito com carregamento de 20 posts por vez
- Lazy loading de imagens e vídeos para performance
- Atualização em tempo real via Supabase Realtime

### Vibe Check (sistema de reações)
- Substitui o botão de curtida por 5 reações temáticas: 🔥 Serving, 💀 Morri, 👑 Iconic, ☕ Chá, 🌊 No Hype
- Apenas uma vibe ativa por post — pode trocar a qualquer momento
- Contagem individual por tipo de reação
- Modal "ver quem reagiu" com abas por tipo de vibe
- Atualização otimista da interface sem esperar resposta do servidor

### Comentários
- Comentários e respostas em threads
- Curtir comentários com contador
- Menções com @ e autocomplete de usuários
- Editar e excluir comentários próprios
- Contagem total incluindo respostas aninhadas
- Preview do comentário mais curtido sem abrir a seção

### Incelicar (repost)
- Repostar post de outra pessoa com um clique
- Repostar com comentário próprio (quote post)
- Contagem de incelicadas no post original
- Notificação para o autor do post original

### Perfil de usuário
- Foto de perfil, nome de exibição e bio
- Contagem de posts, seguidores e seguindo
- Lista de seguidores e seguindo com botão de seguir inline
- Editar perfil com upload de foto
- Excluir conta com confirmação

### Perfil expandido (accordion)
Seções colapsáveis que organizam as integrações externas:
- **🎵 Música** — Last.fm: ouvindo agora, top artistas e músicas da semana
- **🎬 Mídia** — Assistindo agora e Filme favorito via TMDB
- **📚 Leituras** — Lendo agora e Livro favorito via Google Books
- **🎮 Gaming** — Steam: jogando agora e jogos recentes
- **📺 Anime** — Anime favorito via AniList
- **📖 Goodreads** — Livro atual via widget do Goodreads

### Stories
- Stories de 24 horas com imagem
- Visualizador fullscreen com barra de progresso de 5 segundos
- Avançar e voltar entre stories e entre usuários
- Anel colorido para stories não visualizados, desbotado para visualizados
- Curtidas em stories com contador
- Contador de visualizações e curtidas para o dono do story
- Câmera ou galeria para postar story

### Sistema de seguir
- Seguir e deixar de seguir usuários
- Botão "Seguir de volta" quando o usuário já te segue
- Contagem de seguidores e seguindo em tempo real

### Notificações
- Notificações em tempo real com badge de não lidas
- Linguagem personalizada com trocadilhos das Incelicas
- Clicar na notificação navega para o post ou perfil relacionado e marca como lida
- Marcar todas como lidas com um clique
- Tipos: nova vibe, novo seguidor, seguiu de volta, comentário, resposta, curtida em comentário, incelicada, menção

### Integrações externas

| Serviço | Uso |
|---|---|
| Last.fm API | Música ouvindo agora, top artistas e músicas |
| TMDB API | Busca de filmes e séries com pôster |
| Google Books API | Busca de livros com capa |
| AniList GraphQL | Busca de animes e mangas com capa |
| Steam API | Jogo em andamento e histórico recente |
| Goodreads | Widget de leitura atual via HTML embed |
| Spotify API | Metadados de músicas para o jogo diário |
| Deezer API | Preview de 30s para o jogo de música |

### Jogos diários
Página `/jogar` com dois desafios que renovam todo dia à meia-noite (horário de Brasília):

**Adivinhe a Música**
- Ouça trechos crescentes: 1s → 2s → 4s → 8s → 16s → 30s
- Autocomplete com busca no Deezer ao digitar o palpite
- 6 tentativas com pontuação decrescente (600 a 100 pontos)
- Revela capa, título e artista ao final
- Preview completo de 30s após encerrar o jogo
- Botão "Ouvir no Spotify" com link direto

**Termo das Incelicas**
- Wordle em português com palavras temáticas de cultura pop
- 5 letras, 6 tentativas
- Verde = letra correta no lugar certo
- Amarelo = letra existe mas está no lugar errado
- Cinza = letra não existe na palavra
- Algoritmo correto para letras duplicadas
- Teclado virtual responsivo + teclado físico

**Ranking**
- Top 10 por pontuação total, música e termo separados
- Posição do usuário sempre visível mesmo fora do top 10
- Pontuação acumulada ao longo do tempo

**Admin dos jogos** (`/jogar/admin`, exclusivo para conta oficial)
- Adicionar músicas colando link do Spotify (busca metadados e preview Deezer automaticamente)
- Adicionar palavras ao banco do Termo
- Banco rotativo — quando acabar, recomeça do início

### Explorar
- Busca de usuários por nome ou @
- Trending de hashtags das últimas 24 horas
- Sugestões de quem seguir

### Conta oficial e admin
- Perfil `@incelicasappoficial` com badge verificado
- Página `/jogar/admin` exclusiva para a conta oficial
- Criar posts oficiais no feed sem limite de caracteres
- Adicionar entradas ao changelog pelo painel admin
- Post oficial criado automaticamente ao adicionar novidade no changelog

### Páginas institucionais
- `/status` — status do sistema e bugs conhecidos
- `/changelog` — histórico de atualizações com versões e datas

### Tema claro e escuro
- Toggle sol/lua na navbar e no nav mobile
- Preferência salva no localStorage
- Tema claro com visual branco e rosa, escuro com fundo quase preto

### UX e responsividade
- Layout responsivo para mobile e desktop
- Menu inferior fixo no mobile (estilo Twitter)
- Sidebar esquerda com navegação no desktop
- Sidebar direita com trending e sugestões no desktop
- Trending acessível pelo Explorar no mobile
- Modais de confirmação customizados (sem alert nativo do navegador)
- Estados vazios com mensagens personalizadas das Incelicas

## Arquitetura

```
src/
  app/                    # Rotas Next.js (App Router)
    (app)/                # Rotas autenticadas
      feed/               # Feed principal
      profile/[username]/ # Perfil público
      profile/edit/       # Editar perfil
      explore/            # Explorar e busca
      notifications/      # Notificações
      jogar/              # Jogos diários
      jogar/admin/        # Admin dos jogos
    (auth)/               # Rotas de autenticação
      login/
      signup/
    api/                  # API Routes (server-side)
      spotify/            # Proxy Spotify (evita expor credenciais)
      steam/              # Proxy Steam (evita CORS)
    changelog/            # Página pública de novidades
    status/               # Página pública de status
  components/             # Componentes React reutilizáveis
    feed/                 # PostCard, VibeCheck, CommentsSection...
    profile/              # FollowButton, EditProfileForm...
    notifications/        # NotificationBell, NotificationItem...
    games/                # WordGame, MusicGame, GameRanking...
    sidebar/              # TrendingSidebar, WhoToFollow...
  hooks/                  # Custom hooks (useFeed, useUnreadCount...)
  lib/                    # Utilitários e clientes
    supabase/             # Cliente Supabase (client e server)
    officialPost.ts       # Criar posts da conta oficial
    notificationCopy.ts   # Textos personalizados das notificações
  types/                  # TypeScript types
  context/                # UserContext (usuário autenticado global)
```

## Banco de dados

Principais tabelas no PostgreSQL via Supabase:

| Tabela | Descrição |
|---|---|
| `profiles` | Perfis de usuário com todas as integrações |
| `posts` | Posts do feed com suporte a reposts |
| `vibes` | Reações dos posts (único por usuário por post) |
| `comments` | Comentários e respostas |
| `comment_likes` | Curtidas em comentários |
| `follows` | Relações de seguir |
| `notifications` | Notificações de todas as ações |
| `stories` | Stories de 24 horas |
| `story_views` | Visualizações de stories |
| `story_likes` | Curtidas em stories |
| `hashtags` | Extraídas automaticamente dos posts via trigger |
| `daily_songs` | Banco de músicas para o jogo diário |
| `daily_words` | Banco de palavras para o Termo |
| `game_attempts` | Tentativas dos jogos por usuário por dia |
| `game_scores` | Pontuação acumulada dos jogos |
| `changelog_entries` | Histórico de atualizações |

Todas as tabelas têm Row Level Security (RLS) configurado.

Triggers automáticos no banco:
- `handle_new_user` — cria perfil ao cadastrar
- `extract_post_hashtags` — extrai hashtags ao criar/editar post
- `notify_on_vibe` — notifica ao dar vibe
- `notify_on_comment` — notifica ao comentar e responder
- `notify_on_follow` — notifica ao seguir, com lógica de "seguiu de volta"
- `notify_on_comment_like` — notifica ao curtir comentário

## Como rodar localmente

### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### Instalação

```bash
git clone https://github.com/WillianBatista19/IncelicasApp.git
cd IncelicasApp
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis (veja `.env.example` para referência):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_LASTFM_API_KEY=
NEXT_PUBLIC_TMDB_API_KEY=
NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
STEAM_API_KEY=
```

### Banco de dados

Execute o arquivo `supabase/schema.sql` no SQL Editor do seu projeto Supabase para criar todas as tabelas, políticas RLS, triggers e funções.

### Executar

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Deploy

O projeto está configurado para deploy automático no Vercel. Cada push para a branch `master` gera um novo deploy.

Adicione as variáveis de ambiente no painel do Vercel em **Settings → Environment Variables**.

## Funcionalidades planejadas

- [✅] Mensagens diretas entre usuários
- [✅] Grupos de mensagem
- [ ] Comunidades temáticas por interesse
- [ ] Notificações push no celular (Web Push API)
- [ ] Busca de posts por palavra-chave
- [ ] Salvar/favoritar posts
- [ ] PWA — instalar como app no celular
- [ ] Moderação de conteúdo

## Licença

Este projeto é de uso pessoal e educacional.