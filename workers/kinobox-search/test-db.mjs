import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  for (const name of ['0001_history.sql', '0002_telegram_auth.sql'])
    sqlite.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8'))
  return {
    sqlite,
    prepare(sql) {
      return {
        bind(...values) {
          const statement = sqlite.prepare(sql)
          return {
            all: async () => ({ results: statement.all(...values) }),
            first: async () => statement.get(...values) || null,
            run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } })
          }
        }
      }
    },
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    }
  }
}
