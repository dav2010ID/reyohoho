export const getCommentWordForm = (count) => {
  if (count === 1) return 'комментарий'
  if (count >= 2 && count <= 4) return 'комментария'
  return 'комментариев'
}

export const getInitials = (name) => {
  if (!name) return '?'
  const words = name.split(' ')
  if (words.length === 1) {
    return name.slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
