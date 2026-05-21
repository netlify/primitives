import { expectAssignable, expectError } from 'tsd'

import { Config } from '../../src/main.js'

// `memory` alone is valid.
expectAssignable<Config>({ path: '/x', memory: 2048 })
expectAssignable<Config>({ path: '/x', memory: '2gb' })

// `vcpu` alone is valid.
expectAssignable<Config>({ path: '/x', vcpu: 1.5 })
expectAssignable<Config>({ schedule: '5 4 * * *', vcpu: 1 })

// Neither is valid (both are optional).
expectAssignable<Config>({ path: '/x' })

// `background` is a boolean toggle on the config.
expectAssignable<Config>({ path: '/x', background: true })
expectAssignable<Config>({ path: '/x', background: false })
expectAssignable<Config>({ path: '/x', background: true, vcpu: 1.5 })

// Setting both `memory` and `vcpu` is rejected.
expectError<Config>({ path: '/x', memory: 2048, vcpu: 1.5 })
expectError<Config>({ schedule: '5 4 * * *', memory: '2gb', vcpu: 1 })
