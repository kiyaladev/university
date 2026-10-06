import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCoursVODDto, UpdateCoursVODDto, EnregistrerVueDto } from './vod.dto';

describe('booléens VOD sous conversion implicite', () => {
  it.each(['false', 'true', 0, 1])('refuse public=%p à la création et à la modification', async publicValue => {
    for (const Dto of [CreateCoursVODDto, UpdateCoursVODDto]) {
      const dto = plainToInstance(Dto, { titre: 'Cours', type: 'VIDEO', url: '/media.mp4', public: publicValue }, { enableImplicitConversion: true });
      expect((await validate(dto)).some(error => error.property === 'public')).toBe(true);
    }
  });
  it.each(['false', 'true', 0, 1])('refuse termine=%p pour une progression', async termine => {
    const dto = plainToInstance(EnregistrerVueDto, { positionSecondes: 10, dureeSecondes: 100, termine }, { enableImplicitConversion: true });
    expect((await validate(dto)).some(error => error.property === 'termine')).toBe(true);
  });
  it.each([false, true, undefined])('préserve les booléens %p', async value => {
    const course = plainToInstance(CreateCoursVODDto, { titre: 'Cours', type: 'VIDEO', url: '/media.mp4', public: value }, { enableImplicitConversion: true });
    const view = plainToInstance(EnregistrerVueDto, { positionSecondes: 10, dureeSecondes: 100, termine: value }, { enableImplicitConversion: true });
    expect(await validate(course)).toEqual([]);
    expect(await validate(view)).toEqual([]);
    expect(course.public).toBe(value);
    expect(view.termine).toBe(value);
  });
});
