import { expectAssignable } from 'tsd'

import '../../src/main.js'

expectAssignable<{ env: unknown }>(Netlify)
