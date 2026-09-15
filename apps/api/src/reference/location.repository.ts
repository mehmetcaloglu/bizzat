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

export interface ReferenceLocationPath {
  province: { id: string; name: string }
  district: { id: string; name: string }
  neighborhood: { id: string; name: string }
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

  async findActivePath(input: {
    provinceId: string
    districtId: string
    neighborhoodId: string
  }): Promise<ReferenceLocationPath | null> {
    const row = await this.db
      .selectFrom('neighborhoods')
      .innerJoin('districts', 'districts.id', 'neighborhoods.district_id')
      .innerJoin('provinces', 'provinces.id', 'districts.province_id')
      .select([
        'provinces.id as provinceId',
        'provinces.name as provinceName',
        'districts.id as districtId',
        'districts.name as districtName',
        'neighborhoods.id as neighborhoodId',
        'neighborhoods.name as neighborhoodName',
      ])
      .where('provinces.id', '=', input.provinceId)
      .where('districts.id', '=', input.districtId)
      .where('neighborhoods.id', '=', input.neighborhoodId)
      .where('provinces.active', '=', true)
      .where('districts.active', '=', true)
      .where('neighborhoods.active', '=', true)
      .executeTakeFirst()

    if (!row) return null
    return {
      province: { id: row.provinceId, name: row.provinceName },
      district: { id: row.districtId, name: row.districtName },
      neighborhood: { id: row.neighborhoodId, name: row.neighborhoodName },
    }
  }
}
