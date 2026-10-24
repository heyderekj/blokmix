/** Ask for one file (an open dialog), then hand it over. */
export function pickFile(accept: string, then: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => {
    const f = input.files?.[0]
    if (f) then(f)
  }
  input.click()
}
