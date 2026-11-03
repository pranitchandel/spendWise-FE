import { useSearchParams } from 'react-router-dom'

export function useMobileAddForm() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isOpen = searchParams.get('add') === '1'

  function close() {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('add')
    setSearchParams(nextParams, { replace: true })
  }

  return {
    isOpen,
    close,
  }
}
