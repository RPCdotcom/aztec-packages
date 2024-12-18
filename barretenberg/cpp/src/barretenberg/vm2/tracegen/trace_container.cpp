#include "barretenberg/vm2/tracegen/trace_container.hpp"

#include "barretenberg/common/log.hpp"
#include "barretenberg/vm2/common/field.hpp"

namespace bb::avm2::tracegen {
namespace {

// We need a zero value to return (a reference to) when a value is not found.
static const FF zero = FF::zero();

} // namespace

TraceContainer::TraceContainer()
    : trace(std::make_unique<std::array<SparseColumn, NUM_COLUMNS>>())
{}

const FF& TraceContainer::get(Column col, size_t row) const
{
    auto& column_data = (*trace)[static_cast<size_t>(col)];
    std::shared_lock lock(column_data.mutex);
    const auto it = column_data.rows.find(row);
    return it == column_data.rows.end() ? zero : it->second;
}

std::vector<const FF*> TraceContainer::get_multiple(std::span<const Column> cols, size_t row) const
{
    std::vector<const FF*> values;
    values.reserve(cols.size());
    for (const auto col : cols) {
        values.push_back(&get(col, row));
    }
    return values;
}

void TraceContainer::set(Column col, size_t row, const FF& value)
{
    auto& column_data = (*trace)[static_cast<size_t>(col)];
    std::unique_lock lock(column_data.mutex);
    if (!value.is_zero()) {
        column_data.rows.insert_or_assign(row, value);
    } else {
        column_data.rows.erase(row);
    }
}

void TraceContainer::set(size_t row, std::span<const std::pair<Column, FF>> values)
{
    for (const auto& [col, value] : values) {
        set(col, row, value);
    }
}

// TODO: we could cache this, but we'd have to watch out when we set a value to 0.
size_t TraceContainer::get_column_size(Column col) const
{
    auto& column_data = (*trace)[static_cast<size_t>(col)];
    std::shared_lock lock(column_data.mutex);
    auto keys = std::views::keys(column_data.rows);
    const auto it = std::max_element(keys.begin(), keys.end());
    return it == keys.end() ? 0 : *it + 1;
}

size_t TraceContainer::get_num_rows() const
{
    size_t max_rows = 0;
    for (size_t col = 0; col < num_columns(); ++col) {
        max_rows = std::max(max_rows, get_column_size(static_cast<Column>(col)));
    }
    return max_rows;
}

void TraceContainer::visit_column(Column col, const std::function<void(size_t, const FF&)>& visitor) const
{
    auto& column_data = (*trace)[static_cast<size_t>(col)];
    std::shared_lock lock(column_data.mutex);
    for (const auto& [row, value] : column_data.rows) {
        visitor(row, value);
    }
}

void TraceContainer::clear_column(Column col)
{
    auto& column_data = (*trace)[static_cast<size_t>(col)];
    std::unique_lock lock(column_data.mutex);
    column_data.rows.clear();
}

} // namespace bb::avm2::tracegen