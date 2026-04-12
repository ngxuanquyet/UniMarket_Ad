const adminApiBaseUrl =
  (typeof import.meta.env.VITE_ADMIN_API_BASE_URL === 'string'
    ? import.meta.env.VITE_ADMIN_API_BASE_URL
    : ''
  ).trim() || 'http://localhost:8080'

export class AdminApiClient {
  async setUserLock(userId: string, disabled: boolean, idToken: string): Promise<void> {
    await this.request(`/admin/users/${encodeURIComponent(userId)}/lock`, {
      method: 'POST',
      idToken,
      body: { disabled }
    })
  }

  async deleteUser(userId: string, idToken: string): Promise<void> {
    await this.request(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      idToken
    })
  }

  private async request(
    path: string,
    options: {
      method: 'POST' | 'DELETE'
      idToken: string
      body?: Record<string, unknown>
    }
  ): Promise<void> {
    const response = await fetch(`${adminApiBaseUrl}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${options.idToken}`,
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    const responseData = await response
      .json()
      .catch(() => ({ error: `Request failed with status ${response.status}` }))

    if (!response.ok) {
      throw new Error(
        typeof responseData.error === 'string'
          ? responseData.error
          : `Request failed with status ${response.status}`
      )
    }
  }
}

export function getAdminApiBaseUrl(): string {
  return adminApiBaseUrl
}
