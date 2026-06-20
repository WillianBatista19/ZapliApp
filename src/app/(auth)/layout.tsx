import ThemeToggle from '@/components/ThemeToggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeToggle className="fixed right-4 top-4 z-20 rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100" />
      {children}
    </>
  )
}
