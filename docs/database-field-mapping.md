# Database field mapping

This document separates relationships proven by `db_schema.pdf` from descriptive fields confirmed through read-only `sys.columns` metadata and redacted sample queries against the local Portal database. The application uses canonical reporting models and does not expose these source tables to the browser.

The supplied Impro Access Portal transaction report contains these report fields: Date/Time, Display Name, Reader Name, Transaction Type, Device, First Name, Last Name, Department, and ID Number. ID Number is intentionally excluded from the browser contract.

## Confirmed mappings

| Child column | Parent column | Reporting purpose |
| --- | --- | --- |
| `dbo.TRANSACK.TR_MASTER_ID` | `dbo.MASTER.MASTER_ID` | Employee/person |
| `dbo.TRANSACK.TR_HOSTID` | `dbo.MASTER.MASTER_ID` | Host, reader, or device master |
| `dbo.TRANSACK.TRANSACK_TYPE_ID` | `dbo.TRANSACK_TYPE.TRANSACK_TYPE_ID` | Transaction type |
| `dbo.TRANSACK.TR_DEPARTMENT_ID` | `dbo.DEPARTMENT.DEPARTMENT_ID` | Department captured on the transaction |
| `dbo.MASTER.DEPARTMENT_ID` | `dbo.DEPARTMENT.DEPARTMENT_ID` | Employee's current department |
| `dbo.TRANSACK.TR_TERMINAL_ID` | `dbo.TERMINAL.TERMINAL_ID` | Terminal |
| `dbo.TRANSACK.TR_CONTROLLER_ID` | `dbo.CONTROLLER.CONTROLLER_ID` | Controller |
| `dbo.TRANSACK.TR_LOCATION_ID` | `dbo.LOCATION.LOCATION_ID` | Location |
| `dbo.TRANSACK.TR_SITE_ID` | `dbo.SITE.SITE_ID` | Site |
| `dbo.TRANSACK.TR_BUILDING_ID` | `dbo.BUILDING.BUILDING_ID` | Building |
| `dbo.TRANSACK.TR_COMPANY_ID` | `dbo.COMPANY.COMPANY_ID` | Company |
| `dbo.TRANSACK.TR_EVENT_TYPE_ID` | `dbo.EVENT_TYPE.EVENT_TYPE_ID` | Event type |
| `dbo.TRANSACK.TR_UNIT_TYPE_ID` | `dbo.UNIT_TYPE.UNIT_TYPE_ID` | Unit type |
| `dbo.TRANSACK.TR_ZONE_ID` | `dbo.ZONE.ZONE_ID` | Zone |

The primary reporting source is `Portal.dbo.TRANSACK`. The source timestamp is confirmed as `dbo.TRANSACK.TR_DATETIMEUTC` and is treated as UTC. Date filtering uses an inclusive UTC start and exclusive UTC end.

The employee join and host/device join are distinct:

```sql
INNER JOIN dbo.MASTER AS EmployeeMaster
    ON TR.TR_MASTER_ID = EmployeeMaster.MASTER_ID
LEFT JOIN dbo.MASTER AS ReaderHostMaster
    ON TR.TR_HOSTID = ReaderHostMaster.MASTER_ID
```

The schema PDF additionally confirms `dbo.TRANSACK.TRANSACK_ID` as the primary transaction identifier through inbound foreign-key references.

### Confirmed descriptive fields

| Canonical/report field | Confirmed source | Notes |
| --- | --- | --- |
| Display name | `EmployeeMaster.MST_DISPLAYNAME` | Confirmed from metadata and sample results |
| First name | `EmployeeMaster.MST_FIRSTNAME` | Confirmed from metadata and sample results |
| Last name | `EmployeeMaster.MST_LASTNAME` | Confirmed from metadata and sample results |
| ID number | `EmployeeMaster.MST_IDNUMBER` | Confirmed, but deliberately never selected by the application or returned to the browser |
| Department name | `TransactionDepartment.DEPT_NAME` | Matches the captured `TRANSACK.TR_DEPT_NAME` sample values |
| Transaction type description | `TransactionType.TRANSACK_TYPE_NAME` | Sample value: `Access` |
| Reader name | `TR.TR_DEV_NAME` | `ReaderHostMaster.MST_DISPLAYNAME` was `NULL` in the inspected transactions |
| Device name | `TR.TR_DEV_NAME` | Matches the transaction report's Device value |
| Controller name | `TR.TR_CTRL_NAME` | Confirmed captured controller description |
| Location name | `Location.LOC_NAME` | Matches `TRANSACK.TR_LOC_NAME` in inspected samples |

`TR_DATETIMEUTC` is a `varchar(64)`, not a SQL date type. All 286,443 inspected values were valid fixed-width `yyyy-MM-ddTHH:mm:ss.fff` timestamps. `TR_DATETIMELOCAL` was two hours ahead in the sample, confirming that `TR_DATETIMEUTC` is the UTC source for reporting. The provider passes identically formatted UTC strings as parameters so the ISO values remain chronologically sortable without applying a conversion function to the source column.

The confirmed T&A terminal scope is configured locally and parameterised in the query:

| Terminal ID | Confirmed Reader Name | Direction |
| --- | --- | --- |
| `79` | `Main Door T and A Reader  (IN)` | IN |
| `80` | `Main Door T and A Reader  (OUT)` | OUT |
| `95` | `Basement T and A (IN)` | IN |

The two spaces before `(IN)` and `(OUT)` in the real main-door values are significant. They are separate exact entries in the reader mapping; the calculation engine does not infer direction from words.

## Pending mappings

| Canonical/report field | Likely source area | Status |
| --- | --- | --- |
| Employee number | `EmployeeMaster` | Pending column confirmation |
| Terminal name | `TERMINAL` | No descriptive terminal-name column exists in the inspected table; left unset |

No employee-number column was present in the inspected `MASTER` table. The canonical employee-number property remains unset rather than substituting an ID number, card number, or another unconfirmed value.
