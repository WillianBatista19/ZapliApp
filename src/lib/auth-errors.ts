const errorMap: Record<string, string> = {
  'Invalid login credentials':      'Email ou senha incorretos. Tenta de novo, incelica!',
  'Email not confirmed':            'Confirma seu email antes de entrar. Checa tua caixa de entrada!',
  'User already registered':        'Este email já está sendo usado por outra conta.',
  'email address already registered': 'Este email já está sendo usado por outra conta.',
  'Password should be at least 6 characters': 'Senha muito fraca. Usa pelo menos 6 caracteres.',
  'Unable to validate email address: invalid format': 'Email inválido.',
  'For security purposes, you can only request this after':
    'Calma aí! Aguarda alguns minutos para pedir outro email.',
}

export function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) return value
  }
  return 'Algo deu errado. Tenta de novo!'
}
