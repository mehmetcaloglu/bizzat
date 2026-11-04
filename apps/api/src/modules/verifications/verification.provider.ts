export interface VehicleAuthorityVerificationInput {
  listingId: string
  ownerUserId: string
  vehicleModelId: string
  modelYear: number
  plateNationality: string
}

export type VerificationOutcome =
  | { status: 'verified'; providerReference: string | null }
  | { status: 'failed'; failureCode: string }
  | { status: 'unavailable'; failureCode: string }

export interface VerificationProvider {
  readonly name: string
  verifyVehicleAuthority(
    input: VehicleAuthorityVerificationInput,
  ): Promise<VerificationOutcome>
}

export class MockVehicleAuthorityVerificationProvider implements VerificationProvider {
  readonly name = 'mock'

  async verifyVehicleAuthority(
    input: VehicleAuthorityVerificationInput,
  ): Promise<VerificationOutcome> {
    return {
      status: 'verified',
      providerReference: `mock:${input.listingId}`,
    }
  }
}

export class UnavailableVerificationProvider implements VerificationProvider {
  readonly name = 'unconfigured'

  constructor(private readonly failureCode = 'EIDS_PROVIDER_NOT_CONFIGURED') {}

  async verifyVehicleAuthority(): Promise<VerificationOutcome> {
    return {
      status: 'unavailable',
      failureCode: this.failureCode,
    }
  }
}

export function createVerificationProvider(
  env: NodeJS.ProcessEnv = process.env,
): VerificationProvider {
  const nodeEnv = env.NODE_ENV ?? 'development'

  if (nodeEnv === 'production') {
    if (env.EIDS_PROVIDER === 'mock') {
      throw new Error('Mock EIDS verification provider is not allowed in production.')
    }
    return new UnavailableVerificationProvider()
  }

  if (env.EIDS_PROVIDER === 'mock') {
    return new MockVehicleAuthorityVerificationProvider()
  }

  return new UnavailableVerificationProvider()
}
