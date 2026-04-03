export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {children}
    </div>
  )
}
