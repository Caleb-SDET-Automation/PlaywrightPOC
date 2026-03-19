export type OrangeHrmEmployeeTestData = {
  firstName: string;
  lastName: string;
  updatedFirstName: string;
};

export function createOrangeHrmEmployeeTestData(now: number = Date.now()): OrangeHrmEmployeeTestData {
  const firstName = `PW${now}`;
  const lastName = `User${String(now).slice(-4)}`;
  const updatedFirstName = `${firstName}U`;
  return { firstName, lastName, updatedFirstName };
}

