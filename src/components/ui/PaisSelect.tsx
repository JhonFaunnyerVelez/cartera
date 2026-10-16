export const PAISES_AMERICA: { grupo: string; paises: string[] }[] = [
  { grupo: 'Norteamérica', paises: ['Canadá', 'Estados Unidos', 'México'] },
  { grupo: 'Centroamérica', paises: ['Belice', 'Costa Rica', 'El Salvador', 'Guatemala', 'Honduras', 'Nicaragua', 'Panamá'] },
  { grupo: 'Caribe', paises: ['Antigua y Barbuda', 'Bahamas', 'Barbados', 'Cuba', 'Dominica', 'Granada', 'Haití', 'Jamaica', 'República Dominicana', 'San Cristóbal y Nieves', 'Santa Lucía', 'San Vicente y las Granadinas', 'Trinidad y Tobago'] },
  { grupo: 'Sudamérica', paises: ['Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Perú', 'Surinam', 'Uruguay', 'Venezuela'] },
];

export const PAISES_OTROS = ['España', 'Otro'];

export const PAISES = [...PAISES_AMERICA.flatMap((g) => g.paises), ...PAISES_OTROS];

interface PaisSelectProps {
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
}

export default function PaisSelect({ name = 'pais', value, onChange, className }: PaisSelectProps) {
  return (
    <select name={name} value={value} onChange={onChange} className={className}>
      {value && !PAISES.includes(value) && <option>{value}</option>}
      {PAISES_AMERICA.map((g) => (
        <optgroup key={g.grupo} label={g.grupo}>
          {g.paises.map((p) => <option key={p}>{p}</option>)}
        </optgroup>
      ))}
      <optgroup label="Otros">
        {PAISES_OTROS.map((p) => <option key={p}>{p}</option>)}
      </optgroup>
    </select>
  );
}
