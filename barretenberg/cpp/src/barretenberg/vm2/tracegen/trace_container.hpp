#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <functional>
#include <memory>
#include <shared_mutex>
#include <span>
#include <unordered_map>

#include "barretenberg/vm2/common/field.hpp"
#include "barretenberg/vm2/generated/columns.hpp"
#include "barretenberg/vm2/generated/flavor_settings.hpp"

namespace bb::avm2::tracegen {

// This container is thread-safe.
// Contention can only happen when concurrently accessing the same column.
class TraceContainer {
  public:
    TraceContainer();

    const FF& get(Column col, size_t row) const;
    std::vector<const FF*> get_multiple(std::span<const Column> cols, size_t row) const;

    void set(Column col, size_t row, const FF& value);
    // Bulk setting for a given row.
    void set(size_t row, std::span<const std::pair<Column, FF>> values);

    // Visits non-zero values in a column.
    void visit_column(Column col, const std::function<void(size_t, const FF&)>& visitor) const;
    // Returns the number of rows in a column. That is, the maximum non-zero row index + 1.
    size_t get_column_size(Column col) const;
    // Maximum number of rows in any column.
    size_t get_num_rows() const;
    // Number of columns (without shifts).
    static constexpr size_t num_columns() { return NUM_COLUMNS; }

    // Free column memory.
    void clear_column(Column col);

  private:
    // We use a mutex per column to allow for concurrent writes.
    // Observe that therefore concurrent write access to different columns is cheap.
    struct SparseColumn {
        std::shared_mutex mutex;
        std::unordered_map<size_t, FF> rows;
    };
    static constexpr size_t NUM_COLUMNS = static_cast<size_t>(ColumnAndShifts::NUM_COLUMNS);
    // We store the trace as a sparse matrix.
    // We use a unique_ptr to allocate the array in the heap vs the stack.
    // Even if the _content_ of each unordered_map is always heap-allocated, if we have 3k columns
    // we could unnecessarily put strain on the stack with sizeof(unordered_map) * 3k bytes.
    std::unique_ptr<std::array<SparseColumn, NUM_COLUMNS>> trace;
};

} // namespace bb::avm2::tracegen