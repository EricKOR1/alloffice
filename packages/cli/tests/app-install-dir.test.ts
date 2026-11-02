import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appBinaryForResources } from '../src/resources'

describe('appBinaryForResources', () => {
  it('finds the app in a custom Windows install directory', () => {
    expect(appBinaryForResources(join('D:\\Apps\\AllOffice', 'resources'), 'win32')).toBe(
      join('D:\\Apps\\AllOffice', 'AllOffice.exe'),
    )
  })

  it('resolves the same binary for the default Windows install directory', () => {
    const localAppData = 'C:\\Users\\test\\AppData\\Local'
    const resources = join(localAppData, 'Programs', 'AllOffice', 'resources')
    expect(appBinaryForResources(resources, 'win32')).toBe(
      join(localAppData, 'Programs', 'AllOffice', 'AllOffice.exe'),
    )
  })

  it('finds the app in a custom macOS bundle location', () => {
    expect(
      appBinaryForResources(join('/Volumes/Work/AllOffice.app/Contents/Resources'), 'darwin'),
    ).toBe(join('/Volumes/Work/AllOffice.app/Contents/MacOS/AllOffice'))
  })

  it('finds the app in a custom Linux prefix', () => {
    expect(appBinaryForResources(join('/opt/alloffice-custom/resources'), 'linux')).toBe(
      join('/opt/alloffice-custom/alloffice'),
    )
  })
})
