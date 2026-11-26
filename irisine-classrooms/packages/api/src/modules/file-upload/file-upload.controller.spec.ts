import { BadRequestException } from '@nestjs/common';
import { FileUploadController } from './file-upload.controller';

describe('files are kept per school', () => {
  const root = 'schools/s1/';
  let service: any;
  let controller: FileUploadController;

  beforeEach(() => {
    const item = { name: `${root}notes/a.pdf`, size: 1 };
    service = {
      uploadFile: jest.fn(async (_b, name) => `http://storage/bucket/${name}`),
      listByFolder: jest.fn(async () => ({ folders: [`${root}notes/`], files: [item] })),
      listFiles: jest.fn(async () => [item]),
      getStorageStats: jest.fn(async () => ({})),
      getFileInfo: jest.fn(async (name) => ({ name, size: 1 })),
      getSignedUrl: jest.fn(async () => 'signed'),
      deleteFile: jest.fn(async () => undefined),
    };
    controller = new FileUploadController(service);
  });

  const file = { originalname: 'a.pdf', size: 1, buffer: Buffer.from('x'), mimetype: 'application/pdf' } as any;

  it("uploads into the school's own folder and answers with the short name", async () => {
    const res = await controller.uploadFile('s1', file, 'notes');
    expect(service.uploadFile.mock.calls[0][1]).toMatch(/^schools\/s1\/notes\/[\w-]+\.pdf$/);
    expect(res.fileName).toMatch(/^notes\/[\w-]+\.pdf$/);
  });

  it('lists only that folder, without showing the school prefix', async () => {
    const browsed = await controller.browseFiles('s1', 'notes/');
    expect(service.listByFolder).toHaveBeenCalledWith(`${root}notes/`);
    expect(browsed.folders).toEqual(['notes/']);
    expect(browsed.files[0].name).toBe('notes/a.pdf');
    const all = await controller.listFiles('s1');
    expect(service.listFiles).toHaveBeenCalledWith(root);
    expect(all.files[0].name).toBe('notes/a.pdf');
    await controller.getStorageStats('s1');
    expect(service.getStorageStats).toHaveBeenCalledWith(root);
  });

  it("reads and deletes only inside the school's folder", async () => {
    // another school's full path ends up inside the caller's own folder, where it does not exist
    await controller.getSignedUrl('s1', 'schools/s2/secret.pdf');
    expect(service.getSignedUrl).toHaveBeenCalledWith(`${root}schools/s2/secret.pdf`);
    expect((await controller.getFileInfo('s1', 'notes/a.pdf')).name).toBe('notes/a.pdf');
    await controller.deleteFile('s1', 'notes/a.pdf');
    expect(service.deleteFile).toHaveBeenCalledWith(`${root}notes/a.pdf`);
  });

  it.each(['../s2/secret.pdf', 'notes/../../s2/x.pdf', '..\\s2\\x.pdf', '/etc/x.pdf'])('refuses the path %s', async (name) => {
    await expect(controller.deleteFile('s1', name)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getSignedUrl('s1', name)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.uploadFile('s1', file, name)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.deleteFile).not.toHaveBeenCalled();
    expect(service.uploadFile).not.toHaveBeenCalled();
  });
});
