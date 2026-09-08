import type { Kysely } from 'kysely'
import type { Database } from '../db/client.js'

export interface ReferenceProvince {
  id: string
  code: string
  name: string
}

export interface ReferenceDistrict {
  id: string
  name: string
}

export interface ReferenceNeighborhood {
  id: string
  name: string
  kind: string | null
}

export class LocationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  listActiveProvinces(): Promise<ReferenceProvince[]> {
    return this.db
      .selectFrom('provinces')
      .select(['id', 'code', 'name'])
      .where('active', '=', true)
      .orderBy('code', 'asc')
      .orderBy('name', 'asc')
      .execute()
  }

  async findActiveProvinceById(id: string): Promise<{ id: string } | null> {
    return await this.db
      .selectFrom('provinces')
      .select('id')
      .where('id', '=', id)
      .where('active', '=', true)
      .executeTakeFirst() ?? null
  }

  listActiveDistricts(provinceId: string): Promise<ReferenceDistrict[]> {
    return this.db
      .selectFrom('districts')
      .select(['id', 'name'])
      .where('province_id', '=', provinceId)
      .where('active', '=', true)
      .orderBy('name', 'asc')
      .execute()
  }

  async findActiveDistrictById(id: string): Promise<{ id: string } | null> {
    return await this.db
      .selectFrom('districts')
      .select('id')
      .where('id', '=', id)
      .where('active', '=', true)
      .executeTakeFirst() ?? null
  }

  listActiveNeighborhoods(districtId: string): Promise<ReferenceNeighborhood[]> {
    return this.db
      .selectFrom('neighborhoods')
      .select(['id', 'name', 'kind'])
      .where('district_id', '=', districtId)
      .where('active', '=', true)
      .orderBy('name', 'asc')
      .execute()
  }
}
