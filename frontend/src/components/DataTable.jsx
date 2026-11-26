import { useMemo, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TablePagination from '@mui/material/TablePagination';
import { EmptyState, Loading } from './ui';

/**
 * columns: [{ key, label, render?(row), sort?: (row)=>value | false, width, align }]
 */
export default function DataTable({ columns, rows, loading, empty, onRowClick, initialSort, pageSize = 25, dense }) {
  const [sort, setSort] = useState(initialSort || { key: null, dir: 'asc' });
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(pageSize);

  const sorted = useMemo(() => {
    const list = rows || [];
    const col = columns.find((c) => c.key === sort.key);
    if (!col || col.sort === false) return list;
    const val = typeof col.sort === 'function' ? col.sort : (r) => r[col.key];
    return [...list].sort((a, b) => {
      const x = val(a) ?? '';
      const y = val(b) ?? '';
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  if (loading && !rows?.length) return <Loading />;
  if (!sorted.length) return empty || <EmptyState />;
  const pageRows = sorted.slice(page * perPage, page * perPage + perPage);
  const safePage = page * perPage >= sorted.length ? 0 : page;

  return (
    <>
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align} sx={{ width: c.width, whiteSpace: 'nowrap' }}>
                  {c.sort === false || !c.label ? c.label : (
                    <TableSortLabel active={sort.key === c.key} direction={sort.key === c.key ? sort.dir : 'asc'}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {c.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((r, i) => (
              <TableRow key={r.id ?? i} hover={Boolean(onRowClick)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                sx={{ cursor: onRowClick ? 'pointer' : 'default', '&:last-child td': { borderBottom: 0 } }}>
                {columns.map((c) => (
                  <TableCell key={c.key} align={c.align}>{c.render ? c.render(r) : r[c.key] ?? '—'}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {sorted.length > perPage && (
        <TablePagination component="div" count={sorted.length} page={safePage} rowsPerPage={perPage}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]} />
      )}
    </>
  );
}
